"use client"

import * as React from "react"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

import { toLocalYmd } from "@/lib/format"
import { MAX_CALENDAR_COLUMNS } from "@/lib/scheduling/day-calendar"

type Option = { id: string; name: string }

// Calendar filters + day nav. The calendars multi-select (search + checkboxes) is owned by CalendarBoard,
// which filters client-side. Day prev/next/today call onGo; the board decides whether that pages client-side
// within the loaded week or fetches a new week. Date math is plain Y-M-D string arithmetic.
export function CalendarControls({
  attorneys,
  selected,
  onToggle,
  date,
  today,
  onGo,
}: {
  attorneys: Option[]
  selected: string[]
  onToggle: (id: string) => void
  date: string
  today: string // firm-tz today, for the Today button
  onGo: (date: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const atCap = selected.length >= MAX_CALENDAR_COLUMNS

  function shift(days: number): string {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  // Parse the YYYY-MM-DD (firm-tz calendar day) into a LOCAL Date for the picker and back, using local
  // calendar components so the round-trip never shifts a day across time zones.
  const pickedDate = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`))

  const q = query.trim().toLowerCase()
  const filtered = q ? attorneys.filter((a) => a.name.toLowerCase().includes(q)) : attorneys
  const triggerLabel =
    selected.length === attorneys.length
      ? "All calendars"
      : `${selected.length} calendar${selected.length === 1 ? "" : "s"}`

  return (
    <div className="flex flex-wrap items-center gap-1">
      {attorneys.length > 1 ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button type="button" variant="outline" size="default" className="mr-1 justify-between gap-2" />}>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {triggerLabel}
            </span>
            <ChevronDown className="size-4 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <div className="border-b p-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search calendars…"
                autoComplete="off"
                className="h-8"
              />
            </div>
            <ul className="max-h-64 overflow-auto p-1">
              {filtered.length === 0 ? (
                <li className="text-muted-foreground px-2 py-1.5 text-sm">No calendars found.</li>
              ) : (
                filtered.map((a) => {
                  const on = selected.includes(a.id)
                  const disabled = (!on && atCap) || (on && selected.length === 1)
                  return (
                    <li key={a.id}>
                      <label
                        className={cn(
                          "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted cursor-pointer",
                        )}
                      >
                        <Checkbox checked={on} disabled={disabled} onCheckedChange={() => onToggle(a.id)} />
                        <span className="truncate">{a.name}</span>
                      </label>
                    </li>
                  )
                })
              )}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}

      <Button variant="outline" size="icon" onClick={() => onGo(shift(-1))} aria-label="Previous day">
        <ChevronLeft className="size-4" />
      </Button>
      <Button variant="outline" size="default" onClick={() => onGo(today)} disabled={date === today}>
        Today
      </Button>
      <Button variant="outline" size="icon" onClick={() => onGo(shift(1))} aria-label="Next day">
        <ChevronRight className="size-4" />
      </Button>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" size="default" className="ml-1 min-w-[10rem] justify-start gap-2 font-medium" />
          }
        >
          <CalendarDays className="size-4 opacity-60" />
          {dateLabel}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          {/* key={date} remounts the calendar when the viewed day changes (prev/next/Today/pick) so it
              re-applies defaultMonth — react-day-picker only honors defaultMonth on mount, and the popover
              stays mounted. */}
          <Calendar
            key={date}
            mode="single"
            selected={pickedDate}
            defaultMonth={pickedDate}
            onSelect={(d) => {
              if (d) {
                onGo(toLocalYmd(d))
                setPickerOpen(false)
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
