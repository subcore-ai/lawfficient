"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, ChevronDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { ConsultationActions } from "@/components/consultations/consultation-actions"
import { loadConsultationForEdit, updateConsultation } from "@/app/(app)/consultations/actions"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import { consultationStatusMeta } from "@/lib/consultations/queries"
import { addMinutesToTime, minutesBetween, splitWall, utcToZonedInput } from "@/lib/consultations/time"
import type { CalendarConsult } from "@/lib/scheduling/day-calendar"

type Option = { id: string; name: string }
const UNASSIGNED = "__none__"

// A field input styled to read like static text until you hover/focus it — the dialog is both the detail
// view and the editor, so the time/date look read-only but are live (hover shows a border; the native
// picker icon only appears on hover).
const INLINE =
  "border-input/0 hover:border-input focus:border-input focus:bg-muted/40 -mx-1 rounded border bg-transparent px-1 py-0.5 transition-colors outline-none [&::-webkit-calendar-picker-indicator]:opacity-0 hover:[&::-webkit-calendar-picker-indicator]:opacity-60 focus:[&::-webkit-calendar-picker-indicator]:opacity-60"

// Compact human duration, e.g. 85 → "1h 25m", 30 → "30m", 60 → "1h".
function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "0m"
}

// Click-through detail for a booked consult — opens in place (no navigation) and is editable inline:
// date/time are live immediately, type + attorney sit behind "Edit all fields". One view, not two.
export function ConsultPreviewDialog({
  consult,
  open,
  onOpenChange,
  canManage,
}: {
  consult: CalendarConsult | null
  open: boolean
  onOpenChange: (o: boolean) => void
  canManage: boolean
}) {
  const [ready, setReady] = React.useState(false)
  const [attorneys, setAttorneys] = React.useState<Option[]>([])
  const [types, setTypes] = React.useState<ConsultationType[]>([])
  const [leadId, setLeadId] = React.useState("")
  const [attorney, setAttorney] = React.useState(UNASSIGNED)
  const [amount, setAmount] = React.useState(0)
  const [paid, setPaid] = React.useState(false)

  const [day, setDay] = React.useState("")
  const [fromTime, setFromTime] = React.useState("")
  const [toTime, setToTime] = React.useState("")
  const [type, setType] = React.useState("")

  const [showAll, setShowAll] = React.useState(false)
  const [seededId, setSeededId] = React.useState<string | null>(null)
  // Snapshot of the loaded values, to gate "Save changes" on actual edits.
  const [original, setOriginal] = React.useState<{
    date: string
    from: string
    to: string
    type: string
    attorney: string
    amount: number
    paid: boolean
  } | null>(null)
  // Focus a non-input on open so the date field doesn't grab focus + select itself.
  const initialFocusRef = React.useRef<HTMLButtonElement>(null)
  const [pending, startTransition] = React.useTransition()

  // Seed time/type from the calendar consult during render (so editing is instant), keyed by the consult
  // being shown — React-recommended adjust-on-change rather than a sync setState in an effect.
  const activeId = open && consult ? consult.id : null
  if (activeId !== seededId) {
    setSeededId(activeId)
    if (consult && activeId) {
      const when = splitWall(utcToZonedInput(consult.startAt, consult.timeZone))
      setDay(when.day)
      setFromTime(when.time)
      setToTime(when.time ? addMinutesToTime(when.time, consult.endMin - consult.startMin) : "")
      setType(consult.type)
      setShowAll(false)
      setReady(false)
    }
  }

  // Load attorney / fee / paid + the picker lists (for "Edit all fields" and saving) in the background.
  React.useEffect(() => {
    if (!open || !consult) return
    let active = true
    loadConsultationForEdit(consult.id)
      .then((r) => {
        if (!active || !r.ok) return
        setAttorneys(r.attorneys)
        setTypes(r.consultationTypes)
        setLeadId(r.consult.leadId)
        setAttorney(r.consult.attorneyId ?? UNASSIGNED)
        setAmount(r.consult.amount ?? 0)
        setPaid(r.consult.paid)
        setReady(true)
        const seedWhen = splitWall(utcToZonedInput(consult.startAt, consult.timeZone))
        setOriginal({
          date: seedWhen.day,
          from: seedWhen.time,
          to: seedWhen.time ? addMinutesToTime(seedWhen.time, consult.endMin - consult.startMin) : "",
          type: consult.type,
          attorney: r.consult.attorneyId ?? UNASSIGNED,
          amount: r.consult.amount ?? 0,
          paid: r.consult.paid,
        })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [open, consult])

  const activeTypes = types.filter((t) => t.isActive)
  const selected = activeTypes.find((t) => t.name === type)
  const chargeable = (selected?.price ?? 0) > 0 || amount > 0
  const typeDuration = selected?.durationMin ?? 30
  const durationMin = fromTime && toTime ? minutesBetween(fromTime, toTime) : 0
  const validTime = Boolean(day) && durationMin >= 5
  const dirty =
    !!original &&
    (day !== original.date ||
      fromTime !== original.from ||
      toTime !== original.to ||
      type !== original.type ||
      attorney !== original.attorney ||
      amount !== original.amount ||
      paid !== original.paid)

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

  function save() {
    if (!consult) return
    const fd = new FormData()
    fd.set("leadId", leadId) // fixed — updateConsultation validates it but never reassigns the lead
    fd.set("attorneyId", attorney === UNASSIGNED ? "" : attorney)
    fd.set("type", type)
    fd.set("durationMin", String(durationMin))
    fd.set("startAt", day && fromTime ? `${day}T${fromTime}` : "")
    fd.set("timeZone", consult.timeZone)
    fd.set("amount", chargeable ? String(amount) : "")
    fd.set("paid", chargeable && paid ? "on" : "")
    startTransition(async () => {
      try {
        const res = await updateConsultation(consult.id, fd)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" initialFocus={initialFocusRef}>
        {consult ? (
          <>
            <DialogHeader>
              <DialogTitle>{consult.leadName}</DialogTitle>
              <DialogDescription>{type || consult.type}</DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-[5rem_1fr] items-center gap-x-4 gap-y-2.5 py-2 text-sm">
              <dt className="text-muted-foreground self-start pt-1">When</dt>
              <dd className="space-y-1">
                {canManage ? (
                  <>
                    <div>
                      <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={cn(INLINE)} aria-label="Date" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Hide the picker indicator on the time inputs so the box hugs the text and the dash
                          sits an equal distance from each side. */}
                      <input
                        type="time"
                        value={fromTime}
                        onChange={(e) => onFromChange(e.target.value)}
                        className={cn(INLINE, "[&::-webkit-calendar-picker-indicator]:hidden")}
                        aria-label="From"
                      />
                      <span className="text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={toTime}
                        onChange={(e) => setToTime(e.target.value)}
                        className={cn(INLINE, "[&::-webkit-calendar-picker-indicator]:hidden")}
                        aria-label="To"
                      />
                      {validTime ? (
                        <span className="text-muted-foreground ml-2">{formatDuration(durationMin)}</span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <span>{`${day} · ${fromTime} – ${toTime}`}</span>
                )}
              </dd>

              <dt className="text-muted-foreground">Status</dt>
              <dd>{consultationStatusMeta(consult.status).label}</dd>

              {consult.outcome ? (
                <>
                  <dt className="text-muted-foreground">Outcome</dt>
                  <dd className="break-words">{consult.outcome}</dd>
                </>
              ) : null}
            </dl>

            {canManage ? (
              <div className="border-t pt-3">
                <button
                  type="button"
                  ref={initialFocusRef}
                  onClick={() => setShowAll((s) => !s)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
                  aria-expanded={showAll}
                >
                  <ChevronDown className={cn("size-3.5 transition-transform", showAll && "rotate-180")} />
                  Edit all fields
                </button>

                {showAll ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-muted-foreground text-xs">Consultation type</Label>
                      <Select value={type} onValueChange={(v) => onTypeChange(v ?? "")} items={activeTypes.map((t) => ({ value: t.name, label: t.name }))} disabled={!ready}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {activeTypes.map((t) => (
                            <SelectItem key={t.id} value={t.name}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-muted-foreground text-xs">Attorney</Label>
                      <Select value={attorney} onValueChange={(v) => setAttorney(v ?? UNASSIGNED)} items={[{ value: UNASSIGNED, label: "Unassigned" }, ...attorneys.map((a) => ({ value: a.id, label: a.name }))]} disabled={!ready}>
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
                    </div>
                    {chargeable ? (
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Checkbox id="preview-paid" checked={paid} onCheckedChange={(c) => setPaid(c === true)} disabled={!ready} />
                        <Label htmlFor="preview-paid" className="text-sm font-normal">
                          Already paid
                        </Label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter className="flex-row items-center sm:justify-between">
              {consult.leadId ? (
                // render as a Link (an <a>), so tell Base UI it isn't a native <button>.
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/leads/${consult.leadId}`} />}>
                  View full case <ArrowUpRight className="size-4" />
                </Button>
              ) : (
                <span />
              )}
              {canManage ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={save} disabled={pending || !ready || !validTime || !dirty}>
                    {pending ? "Saving…" : "Save changes"}
                  </Button>
                  <ConsultationActions consultationId={consult.id} status={consult.status} outcome={consult.outcome} hideEdit compact />
                </div>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
