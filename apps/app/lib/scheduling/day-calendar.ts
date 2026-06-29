// Builds one attorney's day-view data for the calendar (spec 13, Phase 3). The calendar grid positions
// everything by firm-timezone minutes-of-day; consults + free slots are UTC instants, so we convert. The
// slot engine (lib/availability/slots) runs in UTC; office-hours wall times are converted to UTC for it,
// and its free-slot instants back to wall-minutes for the grid. Deterministic given a fixed tz — tested.
import { generateSlots, type Interval } from "@/lib/availability/slots"
import type { ConsultationStatus } from "@/lib/consultations/validation"
import { utcToZonedInput, zonedWallTimeToUtcISO } from "@/lib/consultations/time"

const MS_PER_MIN = 60_000

// Max attorney columns the day grid shows at once (keeps it legible). Shared by the page (initial slice),
// the board (selection cap), and the picker so the client and server caps can't silently drift.
export const MAX_CALENDAR_COLUMNS = 6

// Firm-tz wall minutes-of-day (0..1439) for a UTC instant.
function wallMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs))
  const h = Number(parts.find((p) => p.type === "hour")?.value)
  const m = Number(parts.find((p) => p.type === "minute")?.value)
  return h * 60 + m
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type CalendarWindow = { startMin: number; endMin: number }
// Why an attorney's day is closed: a firm-wide "holiday" (closes everyone) vs the attorney's own "time_off".
export type OffKind = "holiday" | "time_off"
export type CalendarConsult = {
  id: string
  startMin: number
  endMin: number
  leadName: string
  type: string
  status: ConsultationStatus
  // Carried for the click-through detail dialog (view case + manage):
  leadId: string | null
  startAt: string // UTC ISO
  timeZone: string
  outcome: string | null
}
// startMs = the slot's UTC instant (a stable, collision-free key — wall time repeats on DST fallback);
// startInput = the firm-tz datetime-local string for pre-filling the booking dialog.
export type CalendarSlot = { startMin: number; endMin: number; startMs: number; startInput: string }
export type DayCalendar = {
  weekday: number
  windows: CalendarWindow[]
  consults: CalendarConsult[]
  slots: CalendarSlot[]
  gridStartMin: number
  gridEndMin: number
}

// Wall-clock formatters for the grid, shared by the gutter + columns. mod 24 so a grid widened past
// midnight by a long late consult still labels hours correctly (24:00 → 12 AM, not 12 PM).
export function formatSlotTime(min: number): string {
  const h24 = Math.floor(min / 60) % 24
  const m = min % 60
  const ampm = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}
export function formatHourLabel(hour: number): string {
  const h24 = hour % 24
  const ampm = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12} ${ampm}`
}

// Weekday (0=Sun..6=Sat) of a YYYY-MM-DD calendar date — a date has one weekday regardless of tz.
export function weekdayOf(date: string): number {
  const [y, mo, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1)).getUTCDay()
}

// Monday on or before a YYYY-MM-DD date — the calendar prefetches this whole week so paging days within it
// is client-side (no server round-trip until you cross into a new week).
export function weekStartOf(date: string): string {
  const fromMonday = (weekdayOf(date) + 6) % 7 // Sun→6, Mon→0, Tue→1 … Sat→5
  return addDays(date, -fromMonday)
}

// The 7 dates Mon..Sun of the week containing `date`.
export function weekDatesOf(date: string): string[] {
  const start = weekStartOf(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// Drag-to-reschedule math. A vertical drag of `deltaY` px → a new start-minute-of-day, snapped to `snapMin`
// (default 15). `pxPerMin` is the column's vertical scale. Clamped to >= 0. Pure — unit-tested.
export function draggedStartMin(currentStartMin: number, deltaY: number, pxPerMin: number, snapMin = 15): number {
  const deltaMin = Math.round(deltaY / pxPerMin / snapMin) * snapMin
  return Math.max(0, currentStartMin + deltaMin)
}

// Minutes-of-day → "HH:MM" (24h, zero-padded), for building a wall-time string to convert to UTC.
export function minToHhmm(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = ((min % 60) + 60) % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function buildDayCalendar(opts: {
  date: string // YYYY-MM-DD
  tz: string
  windows: { startTime: string; endTime: string }[] // this weekday's office hours (HH:MM)
  // The attorney's consults that may touch this day — including any that STARTED on the prior day but
  // carry over (the caller buffers the lower bound). All of them block slots; only same-day-start ones show.
  consults: {
    id: string
    startAt: string
    durationMin: number
    leadName: string
    type: string
    status: ConsultationStatus
    leadId: string | null
    timeZone: string
    outcome: string | null
  }[]
  durationMin: number // free-slot length (from the chosen consult type)
  nowMs: number
}): DayCalendar {
  const { date, tz, windows, consults, durationMin, nowMs } = opts

  const calWindows: CalendarWindow[] = windows.map((w) => ({
    startMin: hhmmToMin(w.startTime),
    endMin: hhmmToMin(w.endTime),
  }))

  // Office hours → UTC intervals for the slot engine (the date's wall time in the firm tz).
  const utcWindows: Interval[] = []
  for (const w of windows) {
    const s = zonedWallTimeToUtcISO(`${date}T${w.startTime.slice(0, 5)}`, tz)
    const e = zonedWallTimeToUtcISO(`${date}T${w.endTime.slice(0, 5)}`, tz)
    if (s && e) utcWindows.push({ start: Date.parse(s), end: Date.parse(e) })
  }

  // Day bounds (UTC), to separate same-day consults (shown on this grid) from carry-overs (which belong
  // to the prior day's grid but still block this morning's slots).
  const dayStartMs = Date.parse(zonedWallTimeToUtcISO(`${date}T00:00`, tz) ?? "")
  const dayEndMs = Date.parse(zonedWallTimeToUtcISO(`${addDays(date, 1)}T00:00`, tz) ?? "")
  const bounded = Number.isFinite(dayStartMs) && Number.isFinite(dayEndMs)
  const startsToday = (iso: string) => {
    if (!bounded) return true
    const s = Date.parse(iso)
    return s >= dayStartMs && s < dayEndMs
  }

  const calConsults: CalendarConsult[] = consults
    .filter((c) => startsToday(c.startAt))
    .map((c) => {
      const startMin = wallMinutes(Date.parse(c.startAt), tz)
      return {
        id: c.id,
        startMin,
        endMin: startMin + c.durationMin,
        leadName: c.leadName,
        type: c.type,
        status: c.status,
        leadId: c.leadId,
        startAt: c.startAt,
        timeZone: c.timeZone,
        outcome: c.outcome,
      }
    })
  // Every loaded consult blocks slots; generateSlots ignores any that don't actually overlap a window.
  const booked: Interval[] = consults.map((c) => {
    const s = Date.parse(c.startAt)
    return { start: s, end: s + c.durationMin * MS_PER_MIN }
  })

  const slots: CalendarSlot[] = generateSlots({
    windows: utcWindows,
    booked,
    durationMs: durationMin * MS_PER_MIN,
    nowMs,
  }).map((s) => {
    const startMin = wallMinutes(s, tz)
    return { startMin, endMin: startMin + durationMin, startMs: s, startInput: utcToZonedInput(new Date(s).toISOString(), tz) }
  })

  // Grid spans 8am–6pm by default, widened to fit any earlier/later window or consult.
  const starts = [...calWindows.map((w) => w.startMin), ...calConsults.map((c) => c.startMin)]
  const ends = [...calWindows.map((w) => w.endMin), ...calConsults.map((c) => c.endMin)]
  const gridStartMin = Math.min(8 * 60, ...(starts.length ? starts : [8 * 60]))
  const gridEndMin = Math.max(18 * 60, ...(ends.length ? ends : [18 * 60]))

  return { weekday: weekdayOf(date), windows: calWindows, consults: calConsults, slots, gridStartMin, gridEndMin }
}
