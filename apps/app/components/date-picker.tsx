"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

// A date picker on the shadcn Calendar (in a Popover) — the standard replacement for a native
// <input type="date"> in scheduling UI. `value` / `onChange` are plain "YYYY-MM-DD" strings; the
// round-trip goes through LOCAL calendar components (not Date parsing of the ISO string), so the picked
// day never shifts across a time zone. Mirrors the header picker in consultations/calendar-controls.tsx.

// "YYYY-MM-DD" → a LOCAL Date at midnight (local calendar components, so no UTC-parse day shift). Null
// for an empty or malformed value, so the calendar shows nothing selected and opens on the current month.
function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// A LOCAL Date → "YYYY-MM-DD" from its local calendar components (the inverse of parseLocalDate).
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function DatePicker({
  value,
  onChange,
  disabled,
  id,
  placeholder = "Pick a date",
  className,
  buttonClassName,
  "aria-label": ariaLabel,
  disabledControl = false,
}: {
  // The selected day as "YYYY-MM-DD" ("" = none).
  value: string
  onChange: (value: string) => void
  // Gray out days that fail this matcher (e.g. an attorney's days off) — passed straight to the Calendar.
  disabled?: (date: Date) => boolean
  id?: string
  placeholder?: string
  className?: string
  buttonClassName?: string
  "aria-label"?: string
  // Disable the whole control (the trigger button), distinct from per-day `disabled`.
  disabledControl?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseLocalDate(value)

  const label = selected
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(selected)
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            id={id}
            variant="outline"
            disabled={disabledControl}
            aria-label={ariaLabel}
            className={cn("w-full justify-start gap-2 font-normal", !selected && "text-muted-foreground", buttonClassName)}
          />
        }
      >
        <CalendarDays className="size-4 opacity-60" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-auto p-0", className)}>
        {/* key={value} remounts the calendar when the value changes so it re-applies defaultMonth —
            react-day-picker only honors defaultMonth on mount, and the popover stays mounted. */}
        <Calendar
          key={value}
          mode="single"
          selected={selected ?? undefined}
          defaultMonth={selected ?? undefined}
          disabled={disabled}
          onSelect={(d) => {
            if (d) {
              onChange(toYmd(d))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
