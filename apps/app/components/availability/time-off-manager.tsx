"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { addTimeOff, removeTimeOff } from "@/app/(app)/settings/scheduling/actions"
import { Field } from "@/components/form-field"
import type { TimeOff } from "@/lib/availability/exceptions"

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
}: {
  attorneyId: string
  entries: TimeOff[]
  canEdit: boolean
}) {
  const startId = React.useId()
  const endId = React.useId()
  const noteId = React.useId()
  const [pending, startTransition] = React.useTransition()
  const formRef = React.useRef<HTMLFormElement>(null)

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const res = await addTimeOff(attorneyId, fd)
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success("Time off added")
        formRef.current?.reset()
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
        toast.success("Time off removed")
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No time off scheduled.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{fmtRange(e.startDate, e.endDate)}</span>
                {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
              </div>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(e.id)}
                  disabled={pending}
                  aria-label={`Remove time off ${fmtRange(e.startDate, e.endDate)}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form ref={formRef} onSubmit={onAdd} className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor={startId}>
            <Input id={startId} name="startDate" type="date" required className="w-40" />
          </Field>
          <Field label="To" htmlFor={endId}>
            <Input id={endId} name="endDate" type="date" required className="w-40" />
          </Field>
          <Field label="Note (optional)" htmlFor={noteId}>
            <Input id={noteId} name="note" maxLength={100} placeholder="Vacation" className="w-44" />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add time off"}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
