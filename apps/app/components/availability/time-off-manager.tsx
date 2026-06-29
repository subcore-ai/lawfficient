"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

import { addFirmHoliday, addTimeOff, removeTimeOff } from "@/app/(app)/settings/scheduling/actions"
import { DatePicker } from "@/components/date-picker"
import { Field } from "@/components/form-field"
import type { TimeOff } from "@/lib/availability/exceptions"

// A LOCAL Date → "YYYY-MM-DD" (local components, so a calendar day isn't shifted by the viewer's zone).
function dateToYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmtDate(d: string): string {
  // Noon UTC + UTC formatter so a YYYY-MM-DD never slips a day across the viewer's zone.
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${d}T12:00:00Z`),
  )
}
function fmtRange(start: string, end: string): string {
  return start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`
}

// Per-attorney time off: a list of upcoming ranges + an add form. Used on the profile (self) and Settings
// (admin) scheduling pages. The add/remove actions are gated by RLS (0044) — admin or the owner.
export function TimeOffManager({
  attorneyId,
  entries,
  canEdit,
  noun = "time off",
}: {
  attorneyId: string | null // null = firm-wide holidays
  entries: TimeOff[]
  canEdit: boolean
  noun?: string
}) {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
  const startId = React.useId()
  const endId = React.useId()
  const [pending, startTransition] = React.useTransition()
  // Controlled, since <DatePicker> isn't a native form input — the dates are gathered into FormData on
  // submit (the action reads formData.get("startDate"/"endDate")) and cleared on success.
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!startDate || !endDate) return
    const fd = new FormData()
    fd.set("startDate", startDate)
    fd.set("endDate", endDate)
    startTransition(async () => {
      try {
        const res = attorneyId === null ? await addFirmHoliday(fd) : await addTimeOff(attorneyId, fd)
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success(`${Noun} added`)
        setStartDate("")
        setEndDate("")
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  function onRemove(id: string) {
    startTransition(async () => {
      try {
        const res = await removeTimeOff(id)
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success(`${Noun} removed`)
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No {noun} scheduled.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate font-medium">{fmtRange(e.startDate, e.endDate)}</span>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(e.id)}
                  disabled={pending}
                  aria-label={`Remove ${noun} ${fmtRange(e.startDate, e.endDate)}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor={startId}>
            <DatePicker id={startId} value={startDate} onChange={setStartDate} aria-label="From" buttonClassName="w-40" />
          </Field>
          <Field label="To" htmlFor={endId}>
            <DatePicker
              id={endId}
              value={endDate}
              onChange={setEndDate}
              // Can't end before it starts (the action also enforces end >= start).
              disabled={startDate ? (d) => dateToYmd(d) < startDate : undefined}
              aria-label="To"
              buttonClassName="w-40"
            />
          </Field>
          <Button type="submit" disabled={pending || !startDate || !endDate}>
            {pending ? "Adding…" : `Add ${noun}`}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
