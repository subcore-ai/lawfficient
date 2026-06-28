"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

type Option = { id: string; name: string }

// Keep in step with MAX_COLUMNS in the consultations page / CalendarBoard.
const MAX_ATTORNEYS = 6
// Remember the viewed day within the session, so a tab switch doesn't reset it. (Calendars are remembered
// separately, in a cookie, by CalendarBoard.)
const DATE_KEY = "consultations.calendarDate"

// Calendar filters / nav: a calendars multi-select (search + checkboxes; the selection is owned by
// CalendarBoard, which filters client-side — toggling never hits the server) + the day. Day changes rewrite
// ?date= (the server re-loads the day) and mirror to sessionStorage; on a visit with no ?date= we re-apply
// the remembered day. Date math is plain Y-M-D string arithmetic.
export function CalendarControls({
  attorneys,
  selected,
  onToggle,
  date,
  today,
}: {
  attorneys: Option[]
  selected: string[]
  onToggle: (id: string) => void
  date: string
  today: string // firm-tz today, for the Today button
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const goDate = React.useCallback(
    (d: string) => {
      const params = new URLSearchParams(window.location.search)
      params.set("view", "calendar")
      params.set("date", d)
      window.sessionStorage.setItem(DATE_KEY, d)
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router],
  )

  // On a visit without an explicit ?date=, re-apply the remembered day (once; replace = no back-trap).
  const applied = React.useRef(false)
  React.useEffect(() => {
    if (applied.current) return
    applied.current = true
    const params = new URLSearchParams(window.location.search)
    if (params.has("date")) return
    const savedDate = window.sessionStorage.getItem(DATE_KEY)
    if (savedDate && /^\d{4}-\d{2}-\d{2}$/.test(savedDate) && savedDate !== date) {
      params.set("date", savedDate)
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [date, pathname, router])

  const atCap = selected.length >= MAX_ATTORNEYS

  function shift(days: number): string {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

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

      <Button variant="outline" size="icon" onClick={() => goDate(shift(-1))} aria-label="Previous day">
        <ChevronLeft className="size-4" />
      </Button>
      <Button variant="outline" size="default" onClick={() => goDate(today)} disabled={date === today}>
        Today
      </Button>
      <Button variant="outline" size="icon" onClick={() => goDate(shift(1))} aria-label="Next day">
        <ChevronRight className="size-4" />
      </Button>
      <span className="text-foreground ml-2 inline-block min-w-[9rem] text-sm font-medium">{dateLabel}</span>
    </div>
  )
}
