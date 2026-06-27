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
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import { addMinutesToTime, minutesBetween, splitWall } from "@/lib/consultations/time"
import { FIRM_TIMEZONES } from "@/lib/firm/timezones"

type Option = { id: string; name: string }

const UNASSIGNED = "__none__"
const DEFAULT_TZ = "America/New_York"

export function BookConsultationDialog({
  leads,
  attorneys,
  consultationTypes,
  triggerLeadId,
  label = "Book consultation",
  defaultTimeZone,
  prefillStart,
  prefillStartIso,
  prefillAttorneyId,
  prefillType,
  trigger,
}: {
  leads: Option[]
  attorneys: Option[]
  // Firm-configured types (active ones drive the picker; each carries a default duration + price).
  consultationTypes: ConsultationType[]
  // When booking from a specific lead, pre-select it + hide the picker.
  triggerLeadId?: string
  label?: string
  // The firm's configured zone, used as the picker's default.
  defaultTimeZone?: string | null
  // Calendar click-to-book: pre-fill the slot's start (datetime-local wall string), attorney, and type.
  prefillStart?: string
  // The slot's exact UTC instant — booked directly when "When" is left unedited (DST-fallback-safe).
  prefillStartIso?: string
  prefillAttorneyId?: string
  prefillType?: string
  // Custom trigger element (e.g. a calendar slot button); falls back to the default "Book" button.
  trigger?: React.ReactElement
}) {
  const dayId = React.useId()
  const fromId = React.useId()
  const toId = React.useId()
  const amountId = React.useId()
  const leadSelectId = React.useId()
  const typeSelectId = React.useId()
  const attorneySelectId = React.useId()

  const activeTypes = consultationTypes.filter((t) => t.isActive)
  const firstType = activeTypes.find((t) => t.name === prefillType) ?? activeTypes[0]

  // Seed the picker with the firm's configured zone so a non-Eastern firm doesn't silently book in
  // Eastern; fall back to DEFAULT_TZ when it's unset or not one of the offered zones.
  const initialZone =
    defaultTimeZone && FIRM_TIMEZONES.some((z) => z.value === defaultTimeZone) ? defaultTimeZone : DEFAULT_TZ
  const [open, setOpen] = React.useState(false)
  // No global preselect: an unset lead forces an explicit choice so a missed selection can't silently
  // book onto whichever lead loaded first.
  const [leadId, setLeadId] = React.useState(triggerLeadId ?? "")
  const [attorney, setAttorney] = React.useState(prefillAttorneyId ?? UNASSIGNED)
  const initialWhen = splitWall(prefillStart ?? "")
  const [type, setType] = React.useState(firstType?.name ?? "")
  const [amount, setAmount] = React.useState(firstType?.price ?? 0)
  // Day + from/to time, instead of a single datetime + manual duration. The duration is derived (to − from).
  const [day, setDay] = React.useState(initialWhen.day)
  const [fromTime, setFromTime] = React.useState(initialWhen.time)
  const [toTime, setToTime] = React.useState(
    initialWhen.time ? addMinutesToTime(initialWhen.time, firstType?.durationMin ?? 30) : "",
  )
  const [zone, setZone] = React.useState(initialZone)
  const [paid, setPaid] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const selected = activeTypes.find((t) => t.name === type)
  const chargeable = (selected?.price ?? 0) > 0
  const typeDuration = selected?.durationMin ?? 30
  const durationMin = fromTime && toTime ? minutesBetween(fromTime, toTime) : 0
  const validTime = Boolean(day) && durationMin >= 5

  // Picking a type sets the "to" time (start + the type's default length) and its fee — both stay editable.
  // A free type clears the fee + the "already paid" flag.
  function onTypeChange(name: string) {
    setType(name)
    const t = activeTypes.find((x) => x.name === name)
    if (t) {
      if (fromTime) setToTime(addMinutesToTime(fromTime, t.durationMin))
      setAmount(t.price)
      if (t.price === 0) setPaid(false)
    }
  }

  // Changing the start shifts the end to keep the current length (the type's default if no end is set yet).
  function onFromChange(v: string) {
    const dur = fromTime && toTime ? minutesBetween(fromTime, toTime) : typeDuration
    setFromTime(v)
    setToTime(v ? addMinutesToTime(v, dur > 0 ? dur : typeDuration) : "")
  }

  function reset() {
    setLeadId(triggerLeadId ?? "")
    setAttorney(prefillAttorneyId ?? UNASSIGNED)
    setType(firstType?.name ?? "")
    setAmount(firstType?.price ?? 0)
    setDay(initialWhen.day)
    setFromTime(initialWhen.time)
    setToTime(initialWhen.time ? addMinutesToTime(initialWhen.time, firstType?.durationMin ?? 30) : "")
    setZone(initialZone)
    setPaid(false)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    // Re-seed from the latest props on open (types may have changed in Settings) and clear on close.
    reset()
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("leadId", leadId)
    fd.set("attorneyId", attorney === UNASSIGNED ? "" : attorney)
    fd.set("type", type)
    fd.set("durationMin", String(durationMin))
    const startWall = day && fromTime ? `${day}T${fromTime}` : ""
    fd.set("startAt", startWall)
    // An unedited click-booked slot books its exact instant (avoids the DST-fallback wall ambiguity). Only
    // when BOTH the start AND the zone are untouched — changing either means the user re-expressed the
    // moment, so the server re-derives it from wall + zone.
    const unchanged = prefillStartIso && startWall === (prefillStart ?? "") && zone === initialZone
    fd.set("startAtIso", unchanged ? prefillStartIso : "")
    fd.set("timeZone", zone)
    // Fee + paid only apply to a chargeable type; a free booking carries no amount and is never "paid".
    fd.set("amount", chargeable ? String(amount) : "")
    fd.set("paid", chargeable && paid ? "on" : "")
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
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus className="size-4" /> {label}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Book a consultation</DialogTitle>
            <DialogDescription>Schedule a consultation against an attorney&apos;s calendar.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            {triggerLeadId ? null : (
              <Field label="Lead" htmlFor={leadSelectId} className="sm:col-span-2">
                <Select value={leadId} onValueChange={(v) => setLeadId(v ?? "")} items={leads.map((l) => ({ value: l.id, label: l.name }))}>
                  <SelectTrigger id={leadSelectId} className="w-full">
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
            <Field label="Consultation type" htmlFor={typeSelectId}>
              <Select value={type} onValueChange={(v) => onTypeChange(v ?? "")} items={activeTypes.map((t) => ({ value: t.name, label: t.name }))}>
                <SelectTrigger id={typeSelectId} className="w-full">
                  <SelectValue placeholder={activeTypes.length ? "Select a type" : "Add types in Settings"} />
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Attorney" htmlFor={attorneySelectId}>
              <Select value={attorney} onValueChange={(v) => setAttorney(v ?? UNASSIGNED)} items={[{ value: UNASSIGNED, label: "Unassigned" }, ...attorneys.map((a) => ({ value: a.id, label: a.name }))]}>
                <SelectTrigger id={attorneySelectId} className="w-full">
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
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              <Field label="Day" htmlFor={dayId}>
                <Input id={dayId} type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
              <Field label="From" htmlFor={fromId}>
                <Input id={fromId} type="time" required value={fromTime} onChange={(e) => onFromChange(e.target.value)} />
              </Field>
              <Field label="To" htmlFor={toId}>
                <Input id={toId} type="time" required value={toTime} onChange={(e) => setToTime(e.target.value)} />
              </Field>
              <p
                className={`col-span-3 text-xs ${
                  fromTime && toTime && durationMin < 5 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {fromTime && toTime
                  ? durationMin >= 5
                    ? `Duration: ${durationMin} min`
                    : "End time must be after the start."
                  : "Pick a start and end time."}
              </p>
            </div>
            {chargeable ? (
              <div className="flex items-end gap-4 sm:col-span-2">
                <Field label="Fee ($)" htmlFor={amountId}>
                  <Input
                    id={amountId}
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-32"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  />
                </Field>
                <div className="flex h-9 items-center gap-2">
                  <Checkbox id="paid" checked={paid} onCheckedChange={(c) => setPaid(c === true)} />
                  <Label htmlFor="paid" className="text-sm font-normal">
                    Already paid
                  </Label>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || !leadId || !selected || !validTime}>
              {pending ? "Booking…" : "Book consultation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
