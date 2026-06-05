"use client"

import * as React from "react"
import { CalendarSync, CreditCard, Receipt, SplitSquareHorizontal } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import { Field } from "@/components/form-field"
import { ToastButton } from "@/components/toast-button"
import { useStore } from "@/data/store"
import type { Consultation } from "@/data/types"
import { formatCurrency, formatDateTime } from "@/lib/format"

const ZONES = ["PT", "MT", "CT", "ET", "HT"]

export function RescheduleDialog({ consultation }: { consultation: Consultation }) {
  const { updateConsultation } = useStore()
  const [open, setOpen] = React.useState(false)
  const [zone, setZone] = React.useState(consultation.timeZone)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const date = String(fd.get("date") ?? "")
    const time = String(fd.get("time") ?? "")
    updateConsultation(consultation.id, {
      startAt: `${date}T${time}:00`,
      timeZone: zone,
      status: "rescheduled",
    })
    setOpen(false)
    toast.success("Consultation rescheduled", { description: "Client and attorney notified." })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CalendarSync className="size-4" /> Reschedule
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Reschedule consultation</DialogTitle>
            <DialogDescription>Pick a new slot on the attorney&apos;s calendar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label="Date">
              <Input name="date" type="date" required defaultValue={consultation.startAt.slice(0, 10)} />
            </Field>
            <Field label="Time">
              <Input name="time" type="time" required defaultValue={consultation.startAt.slice(11, 16)} />
            </Field>
            <Field label="Time zone" className="sm:col-span-2">
              <Select
                value={zone}
                onValueChange={(v) => setZone(v ?? consultation.timeZone)}
                items={ZONES.map((z) => ({ value: z, label: z }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Reschedule</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PaymentDialog({
  consultation,
  split = false,
}: {
  consultation: Consultation
  split?: boolean
}) {
  const { updateConsultation } = useStore()
  const [open, setOpen] = React.useState(false)
  const amount = consultation.amount ?? 150

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateConsultation(consultation.id, { paid: true, status: "paid", amount })
    setOpen(false)
    toast.success("Payment processed", {
      description: `${formatCurrency(amount)} charged. Receipt sent to the client.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={split ? "outline" : "default"} size="sm" />}>
        {split ? <SplitSquareHorizontal className="size-4" /> : <CreditCard className="size-4" />}
        {split ? "Split payment" : "Make payment"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{split ? "Split payment" : "Process payment"}</DialogTitle>
            <DialogDescription>
              {split
                ? "Charge the consultation fee across two cards."
                : `Charge ${formatCurrency(amount)} for this consultation.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-5">
            <Card label={split ? "Card 1" : "Card details"} defaultAmount={split ? Math.round(amount / 2) : amount} showAmount={split} />
            {split ? <Card label="Card 2" defaultAmount={amount - Math.round(amount / 2)} showAmount /> : null}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Pay {formatCurrency(amount)}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Card({
  label,
  defaultAmount,
  showAmount,
}: {
  label: string
  defaultAmount: number
  showAmount: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {showAmount ? (
          <Input type="number" defaultValue={defaultAmount} className="h-7 w-24" aria-label={`${label} amount`} />
        ) : null}
      </div>
      <Input placeholder="Card number" defaultValue="4242 4242 4242 4242" />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="MM / YY" defaultValue="04 / 28" />
        <Input placeholder="CVC" defaultValue="123" />
      </div>
    </div>
  )
}

export function ReceiptDialog({ consultation }: { consultation: Consultation }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Receipt className="size-4" /> View receipt
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
          <DialogDescription>Chidolu Law Firm</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-4 text-sm">
          <Row label="Receipt #" value={`RC-${consultation.id.toUpperCase()}`} />
          <Row label="Client" value={consultation.leadName} />
          <Row label="Description" value={consultation.type} />
          <Row label="Date" value={formatDateTime(consultation.startAt)} />
          <Row label="Method" value="Visa •••• 4242" />
          <div className="my-1 border-t" />
          <Row label="Amount paid" value={formatCurrency(consultation.amount ?? 0)} bold />
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
          <ToastButton message="Receipt downloaded">Download PDF</ToastButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  )
}
