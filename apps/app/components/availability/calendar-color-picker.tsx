"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { setCalendarColor } from "@/app/(app)/settings/scheduling/actions"
import { CALENDAR_COLORS } from "@/lib/scheduling/calendar-colors"

// A row of pastel swatches an attorney's calendar can use. Click one to set it; click the active one to
// clear (back to the default). Used on the profile (self) and Settings → Office hours (admin).
export function CalendarColorPicker({
  attorneyId,
  current,
  canEdit,
}: {
  attorneyId: string
  current: string | null
  canEdit: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  const [selected, setSelected] = React.useState<string | null>(current)
  // Re-sync to the server value when it changes (e.g. a save elsewhere revalidated the page).
  const [prevCurrent, setPrevCurrent] = React.useState(current)
  if (current !== prevCurrent) {
    setPrevCurrent(current)
    setSelected(current)
  }

  function pick(key: string | null) {
    const prev = selected
    setSelected(key) // optimistic
    startTransition(async () => {
      try {
        const res = await setCalendarColor(attorneyId, key)
        if ("error" in res) {
          toast.error(res.error)
          setSelected(prev)
        }
      } catch {
        toast.error("Something went wrong. Please try again.")
        setSelected(prev)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CALENDAR_COLORS.map((c) => {
        const on = selected === c.key
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => pick(on ? null : c.key)}
            disabled={!canEdit || pending}
            aria-pressed={on}
            aria-label={on ? `${c.name} (selected — click to clear)` : c.name}
            title={c.name}
            className={cn(
              "ring-offset-background focus-visible:outline-ring flex size-7 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none",
              on && "ring-foreground ring-2 ring-offset-2",
            )}
            style={{ backgroundColor: c.solid }}
          >
            {on ? <Check className="size-3.5" style={{ color: c.text }} /> : null}
          </button>
        )
      })}
    </div>
  )
}
