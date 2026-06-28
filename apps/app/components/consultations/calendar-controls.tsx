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

// Keep in step with MAX_COLUMNS in the consultations page.
const MAX_ATTORNEYS = 6
// Remember the picked calendars across visits (the URL stays the source of truth for the server load).
const STORAGE_KEY = "consultations.calendars"

// Calendar filters / nav: a calendars multi-select (search + checkboxes, 1–N columns) + the day. Each
// change rewrites the URL searchParams (the server re-loads the day) AND mirrors the picked calendars to
// localStorage; on a visit without an explicit ?attorneys= we re-apply the remembered set. Date math is
// plain Y-M-D string arithmetic. The consultation type is chosen when booking, not here.
export function CalendarControls({
  attorneys,
  attorneyIds,
  date,
  today,
}: {
  attorneys: Option[]
  attorneyIds: string[]
  date: string
  today: string // firm-tz today, for the Today button
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const go = React.useCallback(
    (next: { attorneys?: string[]; date?: string }) => {
      const ids = next.attorneys ?? attorneyIds
      const q = new URLSearchParams()
      q.set("view", "calendar")
      q.set("attorneys", ids.join(","))
      q.set("date", next.date ?? date)
      if (next.attorneys) window.localStorage.setItem(STORAGE_KEY, ids.join(","))
      router.push(`${pathname}?${q.toString()}`)
    },
    [attorneyIds, date, pathname, router],
  )

  // On a visit without an explicit ?attorneys=, re-apply the remembered selection (once).
  const applied = React.useRef(false)
  React.useEffect(() => {
    if (applied.current) return
    applied.current = true
    const params = new URLSearchParams(window.location.search)
    if (params.has("attorneys")) return
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    const ids = saved
      .split(",")
      .filter((id) => attorneys.some((a) => a.id === id))
      .slice(0, MAX_ATTORNEYS)
    if (ids.length && ids.join(",") !== attorneyIds.join(",")) {
      params.set("attorneys", ids.join(","))
      router.replace(`${pathname}?${params.toString()}`) // replace: no history entry, no back-trap
    }
  }, [attorneys, attorneyIds, pathname, router])

  const atCap = attorneyIds.length >= MAX_ATTORNEYS

  function toggleAttorney(id: string) {
    const has = attorneyIds.includes(id)
    if (has && attorneyIds.length === 1) return // keep at least one column
    if (!has && atCap) return // respect the column cap
    go({ attorneys: has ? attorneyIds.filter((x) => x !== id) : [...attorneyIds, id] })
  }

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
    attorneyIds.length === attorneys.length
      ? "All calendars"
      : `${attorneyIds.length} calendar${attorneyIds.length === 1 ? "" : "s"}`

  return (
    <div className="space-y-3">
      {attorneys.length > 1 ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button type="button" variant="outline" size="sm" className="justify-between gap-2" />}>
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
                  const on = attorneyIds.includes(a.id)
                  const disabled = (!on && atCap) || (on && attorneyIds.length === 1)
                  return (
                    <li key={a.id}>
                      <label
                        className={cn(
                          "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted cursor-pointer",
                        )}
                      >
                        <Checkbox checked={on} disabled={disabled} onCheckedChange={() => toggleAttorney(a.id)} />
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

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => go({ date: shift(-1) })} aria-label="Previous day">
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="default" onClick={() => go({ date: today })} disabled={date === today}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={() => go({ date: shift(1) })} aria-label="Next day">
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-foreground ml-2 inline-block min-w-[9rem] text-sm font-medium">{dateLabel}</span>
      </div>
    </div>
  )
}
