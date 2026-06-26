"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import { createConsultation } from "@/app/(app)/consultations/actions"
import { Field } from "@/components/form-field"
import { DEFAULT_CONSULTATION_TYPES } from "@/lib/consultations/validation"
import { FIRM_TIMEZONES } from "@/lib/firm/timezones"

type Option = { id: string; name: string }

const UNASSIGNED = "__none__"
const DEFAULT_TZ = "America/New_York"

export function BookConsultationDialog({
  leads,
  attorneys,
  triggerLeadId,
  label = "Book consultation",
  defaultTimeZone,
}: {
  leads: Option[]
  attorneys: Option[]
  // When booking from a specific lead, pre-select it + hide the picker.
  triggerLeadId?: string
  label?: string
  // The firm's configured zone, used as the picker's default.
  defaultTimeZone?: string | null
}) {
  const startAtId = React.useId()
  const durationId = React.useId()
  const amountId = React.useId()
  // Seed the picker with the firm's configured zone so a non-Eastern firm doesn't silently book in
  // Eastern; fall back to DEFAULT_TZ when it's unset or not one of the offered zones.
  const initialZone =
    defaultTimeZone && FIRM_TIMEZONES.some((z) => z.value === defaultTimeZone) ? defaultTimeZone : DEFAULT_TZ
  const [open, setOpen] = React.useState(false)
  // No global preselect: an unset lead forces an explicit choice so a missed selection can't silently
  // book onto whichever lead loaded first.
  const [leadId, setLeadId] = React.useState(triggerLeadId ?? "")
  const [attorney, setAttorney] = React.useState(UNASSIGNED)
  const [type, setType] = React.useState(DEFAULT_CONSULTATION_TYPES[0]!)
  const [zone, setZone] = React.useState(initialZone)
  const [paid, setPaid] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function reset() {
    setLeadId(triggerLeadId ?? "")
    setAttorney(UNASSIGNED)
    setType(DEFAULT_CONSULTATION_TYPES[0]!)
    setZone(initialZone)
    setPaid(false)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("leadId", leadId)
    fd.set("attorneyId", attorney === UNASSIGNED ? "" : attorney)
    fd.set("type", type)
    fd.set("timeZone", zone)
    fd.set("paid", paid ? "on" : "")
    startTransition(async () => {
      try {
        const res = await createConsultation(fd)
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success("Consultation booked")
        onOpenChange(false)
      } catch {
        toast.error("Something went wrong booking the consultation. Please try again.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Book a consultation</DialogTitle>
            <DialogDescription>Schedule a paid or unpaid consultation against an attorney&apos;s calendar.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            {triggerLeadId ? null : (
              <Field label="Lead" className="sm:col-span-2">
                <Select value={leadId} onValueChange={(v) => setLeadId(v ?? "")} items={leads.map((l) => ({ value: l.id, label: l.name }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={leads.length ? "Select a lead" : "No leads yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Consultation type">
              <Select value={type} onValueChange={(v) => setType(v ?? DEFAULT_CONSULTATION_TYPES[0]!)} items={DEFAULT_CONSULTATION_TYPES.map((t) => ({ value: t, label: t }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_CONSULTATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Attorney">
              <Select value={attorney} onValueChange={(v) => setAttorney(v ?? UNASSIGNED)} items={[{ value: UNASSIGNED, label: "Unassigned" }, ...attorneys.map((a) => ({ value: a.id, label: a.name }))]}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {attorneys.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="When" htmlFor={startAtId}>
              <Input id={startAtId} name="startAt" type="datetime-local" required />
            </Field>
            <Field label="Duration (min)" htmlFor={durationId}>
              <Input id={durationId} name="durationMin" type="number" min={5} step={5} defaultValue={30} required />
            </Field>
            <Field label="Time zone" className="sm:col-span-2">
              <Select value={zone} onValueChange={(v) => setZone(v ?? DEFAULT_TZ)} items={FIRM_TIMEZONES.map((z) => ({ value: z.value, label: z.label }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIRM_TIMEZONES.map((z) => (
                    <SelectItem key={z.value} value={z.value}>
                      {z.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <div className="flex items-center gap-2">
                <Checkbox id="paid" checked={paid} onCheckedChange={(c) => setPaid(c === true)} />
                <Label htmlFor="paid" className="text-sm font-normal">
                  Paid consultation
                </Label>
              </div>
              {paid ? (
                <Input id={amountId} name="amount" type="number" min={0} step={25} defaultValue={150} className="h-8 w-28" aria-label="Amount" />
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || !leadId}>
              {pending ? "Booking…" : "Book consultation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
