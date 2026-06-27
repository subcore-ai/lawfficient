"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { WEEKDAYS, type AvailabilityWindow } from "@/lib/availability/queries"
import type { WindowInput } from "@/lib/availability/validation"

// A draft window carries a stable client key: the DB id for a saved row, or a temp id for one added in
// this session. Keying rows by a stable id (not the array index) keeps focus/cursor in place when a
// window on an earlier weekday is removed — index keys would shift every later row.
type Draft = { id: string; weekday: number; startTime: string; endTime: string }
type SaveResult = { ok: true } | { error: string }

function toDraft(windows: AvailabilityWindow[]): Draft[] {
  return windows.map((w) => ({ id: w.id, weekday: w.weekday, startTime: w.startTime, endTime: w.endTime }))
}

// Order-insensitive snapshot of the server windows: only re-seed the draft when the hours actually
// change, not when the same set comes back in a different row order.
function snapshot(windows: AvailabilityWindow[]): string {
  return JSON.stringify(windows.map((w) => `${w.weekday}-${w.startTime}-${w.endTime}`).sort())
}

// Shared weekly office-hours grid: a draft of time windows per weekday with add/remove/edit + a Save.
// Used by the admin Settings editor (one card per attorney) and the self-service profile section — the
// only difference is the `onSave` it's handed (replace this attorney's week vs. replace my own).
//
// `disabled` lets a parent freeze the grid while it runs a sibling action (the admin card disables it
// during a Remove), and `onBusyChange` reports the in-flight save back so the parent can freeze that
// sibling in turn — restoring the single shared-pending behaviour the inline editor used to have.
export function WeeklyHoursEditor({
  windows,
  onSave,
  canEdit,
  saveLabel = "Save office hours",
  disabled = false,
  onBusyChange,
}: {
  windows: AvailabilityWindow[]
  onSave: (windows: WindowInput[]) => Promise<SaveResult>
  canEdit: boolean
  saveLabel?: string
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void
}) {
  const [draft, setDraft] = React.useState<Draft[]>(() => toDraft(windows))
  const [dirty, setDirty] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const tmpId = React.useRef(0)
  const isBusy = pending || disabled

  // Re-sync from server props (a teammate's edit, another tab, our own post-save revalidation) when
  // there are no unsaved edits — adjusting state during render avoids the extra render an effect costs.
  const serverKey = snapshot(windows)
  const [syncedKey, setSyncedKey] = React.useState(serverKey)
  if (serverKey !== syncedKey && !dirty) {
    setSyncedKey(serverKey)
    setDraft(toDraft(windows))
  }

  function addWindow(weekday: number) {
    setDraft((d) => [...d, { id: `tmp-${tmpId.current++}`, weekday, startTime: "09:00", endTime: "17:00" }])
    setDirty(true)
  }
  function updateWindow(id: string, patch: Partial<Draft>) {
    setDraft((d) => d.map((w) => (w.id === id ? { ...w, ...patch } : w)))
    setDirty(true)
  }
  function removeWindow(id: string) {
    setDraft((d) => d.filter((w) => w.id !== id))
    setDirty(true)
  }
  function save() {
    startTransition(async () => {
      onBusyChange?.(true)
      try {
        const res = await onSave(
          draft.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime }))
        )
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success("Office hours saved")
        setDirty(false)
      } catch {
        toast.error("Couldn't save office hours. Try again.")
      } finally {
        onBusyChange?.(false)
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      {WEEKDAYS.map((day) => {
        const entries = draft.filter((w) => w.weekday === day.value)
        return (
          <div
            key={day.value}
            className="border-border flex items-start gap-4 border-b py-2.5 last:border-b-0"
          >
            <div className="text-muted-foreground w-24 shrink-0 pt-2 text-sm">{day.label}</div>
            <div className="flex flex-1 flex-col gap-2">
              {entries.length === 0 ? (
                <span className="text-muted-foreground pt-2 text-sm">Closed</span>
              ) : (
                entries.map((w) => (
                  <div key={w.id} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={w.startTime}
                      onChange={(e) => updateWindow(w.id, { startTime: e.target.value })}
                      disabled={!canEdit || isBusy}
                      className="w-32"
                      aria-label={`${day.label} start time`}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={w.endTime}
                      onChange={(e) => updateWindow(w.id, { endTime: e.target.value })}
                      disabled={!canEdit || isBusy}
                      className="w-32"
                      aria-label={`${day.label} end time`}
                    />
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWindow(w.id)}
                        disabled={isBusy}
                        aria-label={`Remove ${day.label} hours`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => addWindow(day.value)}
                  disabled={isBusy}
                >
                  <Plus className="size-4" /> Add hours
                </Button>
              ) : null}
            </div>
          </div>
        )
      })}
      {canEdit ? (
        <Button onClick={save} disabled={isBusy || !dirty} className="mt-4 self-start">
          {pending ? "Saving…" : saveLabel}
        </Button>
      ) : null}
    </div>
  )
}
