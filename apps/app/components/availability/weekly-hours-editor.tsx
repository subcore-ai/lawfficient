"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { WEEKDAYS, type AvailabilityWindow } from "@/lib/availability/queries"
import type { WindowInput } from "@/lib/availability/validation"

type Draft = { weekday: number; startTime: string; endTime: string }
type SaveResult = { ok: true } | { error: string }

// Shared weekly office-hours grid: a draft of time windows per weekday with add/remove/edit + a Save.
// Used by the admin Settings editor (one card per attorney) and the self-service profile section — the
// only difference is the `onSave` it's handed (replace this attorney's week vs. replace my own).
export function WeeklyHoursEditor({
  windows,
  onSave,
  canEdit,
  saveLabel = "Save office hours",
}: {
  windows: AvailabilityWindow[]
  onSave: (windows: WindowInput[]) => Promise<SaveResult>
  canEdit: boolean
  saveLabel?: string
}) {
  const [draft, setDraft] = React.useState<Draft[]>(() =>
    windows.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime }))
  )
  const [dirty, setDirty] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  // Re-sync from server props (a teammate's edit, another tab, our own post-save revalidation) when
  // there are no unsaved edits — adjusting state during render avoids the extra render an effect costs.
  const serverKey = JSON.stringify(windows)
  const [syncedKey, setSyncedKey] = React.useState(serverKey)
  if (serverKey !== syncedKey && !dirty) {
    setSyncedKey(serverKey)
    setDraft(windows.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime })))
  }

  function addWindow(weekday: number) {
    setDraft((d) => [...d, { weekday, startTime: "09:00", endTime: "17:00" }])
    setDirty(true)
  }
  function updateWindow(index: number, patch: Partial<Draft>) {
    setDraft((d) => d.map((w, i) => (i === index ? { ...w, ...patch } : w)))
    setDirty(true)
  }
  function removeWindow(index: number) {
    setDraft((d) => d.filter((_, i) => i !== index))
    setDirty(true)
  }
  function save() {
    startTransition(async () => {
      const res = await onSave(draft)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Office hours saved")
      setDirty(false)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      {WEEKDAYS.map((day) => {
        const entries = draft.map((w, i) => ({ w, i })).filter((e) => e.w.weekday === day.value)
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
                entries.map(({ w, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={w.startTime}
                      onChange={(e) => updateWindow(i, { startTime: e.target.value })}
                      disabled={!canEdit || pending}
                      className="w-32"
                      aria-label={`${day.label} start time`}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={w.endTime}
                      onChange={(e) => updateWindow(i, { endTime: e.target.value })}
                      disabled={!canEdit || pending}
                      className="w-32"
                      aria-label={`${day.label} end time`}
                    />
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWindow(i)}
                        disabled={pending}
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
                  disabled={pending}
                >
                  <Plus className="size-4" /> Add hours
                </Button>
              ) : null}
            </div>
          </div>
        )
      })}
      {canEdit ? (
        <Button onClick={save} disabled={pending || !dirty} className="mt-4 self-start">
          {pending ? "Saving…" : saveLabel}
        </Button>
      ) : null}
    </div>
  )
}
