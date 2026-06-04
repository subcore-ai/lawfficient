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
import { Textarea } from "@workspace/ui/components/textarea"

import { Field } from "@/components/form-field"
import { CASE_TYPES, STAFF } from "@/data"
import { useStore } from "@/data/store"
import type { CaseType } from "@/data/types"

const ATTORNEYS = STAFF.filter((u) => u.role === "attorney")
const DEFAULT_ATTORNEY = ATTORNEYS[0]?.id ?? "u1"
const TYPES = ["Initial consultation", "Paid consultation", "Follow-up", "Strategy session"]
const ZONES = ["PT", "MT", "CT", "ET", "HT"]

export function BookConsultationDialog() {
  const { addConsultation } = useStore()
  const [open, setOpen] = React.useState(false)
  const [attorney, setAttorney] = React.useState(DEFAULT_ATTORNEY)
  const [type, setType] = React.useState("Initial consultation")
  const [zone, setZone] = React.useState("ET")
  const [caseType, setCaseType] = React.useState("none")
  const [paid, setPaid] = React.useState(false)

  function reset() {
    setAttorney(DEFAULT_ATTORNEY)
    setType("Initial consultation")
    setZone("ET")
    setCaseType("none")
    setPaid(false)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const get = (k: string) => String(fd.get(k) ?? "").trim()
    const name = `${get("firstName")} ${get("lastName")}`.trim() || "New client"
    const startAt = `${get("date")}T${get("time")}:00`
    const amount = Number(get("amount")) || 150

    addConsultation({
      leadName: name,
      attorneyId: attorney,
      type,
      paid,
      amount: paid ? amount : undefined,
      startAt,
      timeZone: zone,
      caseType: caseType === "none" ? undefined : (caseType as CaseType),
    })

    toast.success("Consultation booked", {
      description: "Added to the attorney's calendar; confirmation sent.",
    })
    form.reset()
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Book consultation
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Book a consultation</DialogTitle>
            <DialogDescription>
              Schedule a paid or unpaid consultation against an attorney&apos;s calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label="First name">
              <Input name="firstName" required placeholder="Maria" />
            </Field>
            <Field label="Last name">
              <Input name="lastName" required placeholder="Gonzalez" />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" placeholder="(305) 555-0142" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="maria@email.com" />
            </Field>
            <Field label="Attorney">
              <Select value={attorney} onValueChange={(v) => setAttorney(v ?? DEFAULT_ATTORNEY)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select attorney" />
                </SelectTrigger>
                <SelectContent>
                  {ATTORNEYS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Appointment type">
              <Select value={type} onValueChange={(v) => setType(v ?? "Initial consultation")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date">
              <Input name="date" type="date" required />
            </Field>
            <Field label="Time">
              <Input name="time" type="time" required />
            </Field>
            <Field label="Time zone">
              <Select value={zone} onValueChange={(v) => setZone(v ?? "ET")}>
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
            <Field label="Case type">
              <Select value={caseType} onValueChange={(v) => setCaseType(v ?? "none")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Case type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {CASE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
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
                <Input
                  name="amount"
                  type="number"
                  min={0}
                  step={25}
                  defaultValue={150}
                  className="h-8 w-28"
                  aria-label="Amount"
                />
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea name="notes" rows={2} placeholder="Case background, referral source…" />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Schedule appointment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
