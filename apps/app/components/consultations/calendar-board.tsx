"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { CalendarControls } from "@/components/consultations/calendar-controls"
import { DayCalendar } from "@/components/consultations/day-calendar-grid"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import type { ConsultationStatus } from "@/lib/consultations/validation"
import type { CalendarColor } from "@/lib/scheduling/calendar-colors"
import { buildDayCalendar, MAX_CALENDAR_COLUMNS, weekdayOf } from "@/lib/scheduling/day-calendar"
import { createClient } from "@/lib/supabase/client"

type Option = { id: string; name: string }

// A consult as the calendar needs it (lead name resolved).
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

// One attorney's whole loaded week: office hours by weekday (0=Sun..6=Sat), the week's consults, and which
// dates are off (time off). The browser builds the picked day's column from this, so paging days within the
// loaded week never hits the server.
export type AttorneyWeek = {
  attorney: Option
  color: CalendarColor | null
  hoursByWeekday: Record<number, { startTime: string; endTime: string }[]>
  offDates: string[]
  consults: DayConsult[]
}

// The picked calendars + the viewed day live in cookies so the server renders the right set/day on first
// paint (no flash). "." separates calendar ids (UUIDs have none); a year's persistence.
const CALENDARS_COOKIE = "consultations.calendars"
const DATE_COOKIE = "consultations.calendarDate"

function writeSelection(ids: string[]) {
  document.cookie = `${CALENDARS_COOKIE}=${ids.join(".")}; path=/; max-age=31536000; samesite=lax`
}

export function CalendarBoard({
  attorneyWeeks,
  weekStart,
  weekDates,
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
  attorneyWeeks: AttorneyWeek[]
  weekStart: string
  weekDates: string[]
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
  const router = useRouter()
  const [selected, setSelected] = React.useState<string[]>(initialSelected)

  // The viewed day within the loaded week — paged client-side. When the server loads a different week (a
  // cross-week jump), reset to that week's anchor. adjust-during-render: React re-renders immediately, no effect.
  const [selectedDate, setSelectedDate] = React.useState(date)
  const [loadedWeek, setLoadedWeek] = React.useState(weekStart)
  if (weekStart !== loadedWeek) {
    setLoadedWeek(weekStart)
    setSelectedDate(date)
  }

  // If the firm's calendars change (an attorney removed), drop stale ids from the selection.
  const validSelected = selected.filter((id) => attorneyWeeks.some((a) => a.attorney.id === id))
  const atCap = validSelected.length >= MAX_CALENDAR_COLUMNS

  function toggle(id: string) {
    const has = validSelected.includes(id)
    if (has && validSelected.length === 1) return // keep at least one column
    if (!has && atCap) return // respect the column cap
    const next = has ? validSelected.filter((x) => x !== id) : [...validSelected, id]
    setSelected(next)
    writeSelection(next)
  }

  // Day navigation. Within the loaded week → pure client state + sync ?date= via the History API (no server
  // round-trip). Crossing the week → router.push so the server loads the new week. Either way, remember the
  // day in a cookie for a later visit with no ?date=.
  function goToDate(d: string) {
    document.cookie = `${DATE_COOKIE}=${d}; path=/; max-age=31536000; samesite=lax`
    const params = new URLSearchParams(window.location.search)
    params.set("view", "calendar")
    params.set("date", d)
    const url = `${window.location.pathname}?${params.toString()}`
    if (weekDates.includes(d)) {
      setSelectedDate(d)
      window.history.replaceState(null, "", url)
    } else {
      router.push(url)
    }
  }

  // Realtime: subscribe to consultation changes (Postgres Changes respects RLS, so only this firm's) and
  // re-load the week from the server on a change — a booking / reschedule / cancel by anyone shows live.
  // Debounced to coalesce bursts; the selection + viewed day persist (React state) across the refresh.
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

  // Build the picked columns for the viewed day, in the browser. buildDayCalendar shows only same-day-start
  // consults and ignores non-overlapping ones, so handing it the whole week's consults is safe. (≤6 columns.)
  const weekday = weekdayOf(selectedDate)
  const columns = attorneyWeeks
    .filter((a) => validSelected.includes(a.attorney.id))
    .map((a) => {
      const off = a.offDates.includes(selectedDate)
      const windows = off ? [] : (a.hoursByWeekday[weekday] ?? [])
      return {
        attorney: a.attorney,
        cal: buildDayCalendar({ date: selectedDate, tz, windows, consults: a.consults, durationMin: slotDuration, nowMs }),
        off,
        color: a.color,
      }
    })

  const hasContent = columns.some((c) => c.off || c.cal.windows.length > 0 || c.cal.consults.length > 0)

  return (
    <div className="space-y-4">
      <CalendarControls
        attorneys={attorneyWeeks.map((a) => a.attorney)}
        selected={validSelected}
        onToggle={toggle}
        date={selectedDate}
        today={today}
        onGo={goToDate}
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
