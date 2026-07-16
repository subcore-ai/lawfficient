"use client"

import * as React from "react"

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
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import {
  loadConsultationForEdit,
  setConsultationStatus,
  updateConsultation,
} from "@/app/(app)/consultations/actions"
import { DatePicker } from "@/components/date-picker"
import { Field } from "@/components/form-field"
import { isDateOff, type OffDateRange } from "@/lib/availability/exceptions"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import { addMinutesToTime, minutesBetween, splitWall, utcToZonedInput } from "@/lib/consultations/time"
import { toLocalYmd } from "@/lib/format"
import { NONE, noneToEmpty, personOptions } from "@/lib/select-sentinel"

type Option = { id: string; name: string }

// Edit a booked consultation with the same fields as creating one — type, attorney, day + from/to, fee —
// except the lead (which is fixed). The consult + the attorney/type lists are loaded on open, so the
// actions menu only needs the consult id. Also offers "Cancel consultation" (cancels the appointment).
export function EditConsultationDialog({
  consultationId,
  open,
  onOpenChange,
}: {
  consultationId: string
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const typeSelectId = React.useId()
  const attorneySelectId = React.useId()
  const dayId = React.useId()
  const fromId = React.useId()
  const toId = React.useId()
  const amountId = React.useId()
  const paidId = React.useId()

  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [attorneys, setAttorneys] = React.useState<Option[]>([])
  const [types, setTypes] = React.useState<ConsultationType[]>([])
  const [offDatesByAttorney, setOffDatesByAttorney] = React.useState<Record<string, OffDateRange[]>>({})
  const [leadId, setLeadId] = React.useState("")
  const [leadName, setLeadName] = React.useState("")

  const [type, setType] = React.useState("")
  const [attorney, setAttorney] = React.useState(NONE)
  const [amount, setAmount] = React.useState(0)
  const [paid, setPaid] = React.useState(false)
  const [day, setDay] = React.useState("")
  const [fromTime, setFromTime] = React.useState("")
  const [toTime, setToTime] = React.useState("")
  const [zone, setZone] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  // Reset transient state when the dialog reopens (it stays mounted) so it shows the loader, not the
  // previously-loaded consult. Adjusted during render on the open transition, not in the load effect.
  const [wasOpen, setWasOpen] = React.useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setLoading(true)
      setLoadError(null)
    }
  }

  // Load + seed each time the dialog opens (it's controlled by the actions menu and stays mounted).
  React.useEffect(() => {
    if (!open) return
    let active = true
    loadConsultationForEdit(consultationId)
      .then((r) => {
        if (!active) return
        if (!r.ok) {
          setLoadError(r.error)
          return
        }
        setLoadError(null)
        setAttorneys(r.attorneys)
        setTypes(r.consultationTypes)
        setOffDatesByAttorney(r.offDatesByAttorney)
        const c = r.consult
        setLeadId(c.leadId)
        setLeadName(c.leadName)
        setType(c.type)
        setAttorney(c.attorneyId ?? NONE)
        setAmount(c.amount ?? 0)
        setPaid(c.paid)
        const when = splitWall(utcToZonedInput(c.startAtIso, c.timeZone))
        setDay(when.day)
        setFromTime(when.time)
        setToTime(when.time ? addMinutesToTime(when.time, c.durationMin) : "")
        setZone(c.timeZone)
      })
      .catch(() => {
        if (active) setLoadError("Couldn't load the consultation.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, consultationId])

  const activeTypes = types.filter((t) => t.isActive)
  const selected = activeTypes.find((t) => t.name === type)
  const typeNames = new Set(activeTypes.map((t) => t.name))
  const chargeable = (selected?.price ?? 0) > 0 || amount > 0
  const typeDuration = selected?.durationMin ?? 30
  const durationMin = fromTime && toTime ? minutesBetween(fromTime, toTime) : 0
  const validTime = Boolean(day) && durationMin >= 5

  // Gray out days the selected attorney is fully off (own time off + firm holidays). Only when an attorney
  // is selected and we have their ranges; the server (0051 trigger) still re-checks on save — friendly guard.
  const attorneyOff = attorney !== NONE ? offDatesByAttorney[attorney] : undefined
  const disabledDay = attorneyOff?.length ? (d: Date) => isDateOff(attorneyOff, toLocalYmd(d)) : undefined
  // The picker only blocks NEW picks; if the chosen attorney is off on the already-picked day (e.g. after
  // switching attorneys), treat it as invalid so Save can't proceed — the server (0051 trigger) re-checks.
  const dayIsOff = Boolean(day && attorneyOff?.length && isDateOff(attorneyOff, day))

  // Picking a type sets the "to" time (start + the type's length) and its fee — both stay editable.
  function onTypeChange(name: string) {
    setType(name)
    const t = activeTypes.find((x) => x.name === name)
    if (t) {
      if (fromTime) setToTime(addMinutesToTime(fromTime, t.durationMin))
      setAmount(t.price)
      if (t.price === 0) setPaid(false)
    }
  }
  function onFromChange(v: string) {
    const dur = fromTime && toTime ? minutesBetween(fromTime, toTime) : typeDuration
    setFromTime(v)
    setToTime(v ? addMinutesToTime(v, dur > 0 ? dur : typeDuration) : "")
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set("leadId", leadId) // fixed — updateConsultation validates it but never reassigns the lead
    fd.set("attorneyId", noneToEmpty(attorney))
    fd.set("type", type)
    fd.set("durationMin", String(durationMin))
    fd.set("startAt", day && fromTime ? `${day}T${fromTime}` : "")
    fd.set("timeZone", zone)
    fd.set("amount", chargeable ? String(amount) : "")
    fd.set("paid", chargeable && paid ? "on" : "")
    startTransition(async () => {
      try {
        const res = await updateConsultation(consultationId, fd)
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success("Consultation updated")
        onOpenChange(false)
      } catch {
        toast.error("Something went wrong updating the consultation. Please try again.")
      }
    })
  }

  function cancelConsult() {
    startTransition(async () => {
      try {
        const res = await setConsultationStatus(consultationId, "canceled")
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success("Consultation canceled")
        onOpenChange(false)
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  // Show the consult's current type even if it's since been deactivated, so it still displays.
  const typeItems = [
    ...activeTypes.map((t) => ({ value: t.name, label: t.name })),
    ...(type && !typeNames.has(type) ? [{ value: type, label: `${type} (inactive)` }] : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit consultation</DialogTitle>
          <DialogDescription>
            {loading ? "Loading…" : leadName ? `Consultation for ${leadName}.` : "Update the consultation’s details."}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div className="py-6">
            <p className="text-destructive text-sm">{loadError}</p>
            <DialogFooter className="mt-4">
              <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
            </DialogFooter>
          </div>
        ) : loading ? (
          <div className="text-muted-foreground py-10 text-center text-sm">Loading…</div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="grid gap-4 py-5 sm:grid-cols-2">
              <Field label="Consultation type" htmlFor={typeSelectId}>
                <Select value={type} onValueChange={(v) => onTypeChange(v ?? "")} items={typeItems}>
                  <SelectTrigger id={typeSelectId} className="w-full">
                    <SelectValue placeholder={typeItems.length ? "Select a type" : "Add types in Settings"} />
                  </SelectTrigger>
                  <SelectContent>
                    {typeItems.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Attorney" htmlFor={attorneySelectId}>
                <Select
                  value={attorney}
                  onValueChange={(v) => setAttorney(v ?? NONE)}
                  items={personOptions(attorneys)}
                >
                  <SelectTrigger id={attorneySelectId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
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
                  <DatePicker id={dayId} value={day} onChange={setDay} disabled={disabledDay} aria-label="Day" />
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
                    <Input id={amountId} type="number" min={0} step="0.01" className="w-32" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
                  </Field>
                  <div className="flex h-9 items-center gap-2">
                    <Checkbox id={paidId} checked={paid} onCheckedChange={(c) => setPaid(c === true)} />
                    <Label htmlFor={paidId} className="text-sm font-normal">
                      Already paid
                    </Label>
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="destructive" disabled={pending} onClick={cancelConsult}>
                Cancel consultation
              </Button>
              <div className="flex gap-2">
                <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
                <Button type="submit" disabled={pending || !type || !validTime || dayIsOff}>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
