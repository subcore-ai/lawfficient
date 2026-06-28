"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { CalendarControls } from "@/components/consultations/calendar-controls"
import { DayCalendar } from "@/components/consultations/day-calendar-grid"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import type { ConsultationStatus } from "@/lib/consultations/validation"
import type { CalendarColor } from "@/lib/scheduling/calendar-colors"
import { buildDayCalendar } from "@/lib/scheduling/day-calendar"
import { createClient } from "@/lib/supabase/client"

type Option = { id: string; name: string }

// A consult as the calendar needs it (lead name resolved). Held in client state so realtime can mutate it.
export type DayConsult = {
  id: string
  startAt: string
  durationMin: number
  type: string
  leadName: string
  status: ConsultationStatus
  leadId: string | null
  timeZone: string
  outcome: string | null
}

// One attorney's raw day (office-hour windows already account for time off). The whole firm's set is loaded
// once; the board builds + filters columns in the browser, so toggling calendars never hits the server.
export type AttorneyDay = {
  attorney: Option
  windows: { startTime: string; endTime: string }[]
  consults: DayConsult[]
  off: boolean
  color: CalendarColor | null
}

const MAX_COLUMNS = 6
// The picked calendars live in a cookie so the server can render the right set on first paint (no flash) and
// the URL stays clean. "." separates ids (UUIDs have none); a year's persistence.
const COOKIE = "consultations.calendars"

function writeSelection(ids: string[]) {
  document.cookie = `${COOKIE}=${ids.join(".")}; path=/; max-age=31536000; samesite=lax`
}

export function CalendarBoard({
  attorneyDays,
  initialSelected,
  date,
  today,
  tz,
  slotDuration,
  slotTypeName,
  nowMs,
  leads,
  attorneys,
  consultationTypes,
  canBook,
}: {
  attorneyDays: AttorneyDay[]
  initialSelected: string[]
  date: string
  today: string
  tz: string
  slotDuration: number
  slotTypeName: string
  nowMs: number
  leads: Option[]
  attorneys: Option[]
  consultationTypes: ConsultationType[]
  canBook: boolean
}) {
  const [selected, setSelected] = React.useState<string[]>(initialSelected)
  const router = useRouter()

  // If the firm's calendars change (an attorney removed), drop stale ids from the selection.
  const validSelected = selected.filter((id) => attorneyDays.some((a) => a.attorney.id === id))
  const atCap = validSelected.length >= MAX_COLUMNS

  function toggle(id: string) {
    const has = validSelected.includes(id)
    if (has && validSelected.length === 1) return // keep at least one column
    if (!has && atCap) return // respect the column cap
    const next = has ? validSelected.filter((x) => x !== id) : [...validSelected, id]
    setSelected(next)
    writeSelection(next)
  }

  // Realtime: subscribe to consultation changes (Postgres Changes respects RLS, so only this firm's) and
  // re-load the day from the server on a change — a booking / reschedule / cancel by anyone shows live.
  // Debounced to coalesce bursts; the day's selection persists (React state) across the refresh.
  React.useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    let channel: ReturnType<typeof supabase.channel> | undefined
    let active = true
    // Authenticate the realtime socket with the user's session FIRST — otherwise Postgres Changes runs as
    // anon and RLS silently drops every event (the common "realtime isn't working" cause with @supabase/ssr).
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session?.access_token) void supabase.realtime.setAuth(data.session.access_token)
      channel = supabase
        .channel("consultations-calendar")
        .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => router.refresh(), 400)
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("[calendar realtime]", status)
        })
    })
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [router])

  // Build only the picked columns, in the browser — no server round-trip on toggle. (≤6 columns, cheap.)
  const columns = attorneyDays
    .filter((a) => validSelected.includes(a.attorney.id))
    .map((a) => ({
      attorney: a.attorney,
      cal: buildDayCalendar({ date, tz, windows: a.windows, consults: a.consults, durationMin: slotDuration, nowMs }),
      off: a.off,
      color: a.color,
    }))

  const hasContent = columns.some((c) => c.off || c.cal.windows.length > 0 || c.cal.consults.length > 0)

  return (
    <div className="space-y-4">
      <CalendarControls
        attorneys={attorneyDays.map((a) => a.attorney)}
        selected={validSelected}
        onToggle={toggle}
        date={date}
        today={today}
      />
      <div className="rounded-lg border p-4">
        {!hasContent ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No office hours set for the selected {columns.length > 1 ? "attorneys" : "attorney"} on this day.
          </p>
        ) : (
          <DayCalendar
            columns={columns}
            typeName={slotTypeName}
            leads={leads}
            attorneys={attorneys}
            consultationTypes={consultationTypes}
            defaultTimeZone={tz}
            canBook={canBook}
          />
        )}
      </div>
    </div>
  )
}
