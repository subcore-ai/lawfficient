// Attorney-availability view model: maps an attorney_availability row (migration 0040) into the shape
// the office-hours editor + calendar consume. Recurring weekly office hours; the slot engine lands in
// Phase 2. Pure + unit-tested.
import type { Database } from "@/lib/supabase/database.types"

type AvailabilityRow = Database["public"]["Tables"]["attorney_availability"]["Row"]

// weekday 0=Sunday .. 6=Saturday (JS getDay / Postgres DOW), matching the 0040 check + seed.
export const WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const

export type AvailabilityWindow = {
  id: string
  attorneyId: string
  weekday: number
  startTime: string // "HH:MM" wall time in the firm tz
  endTime: string
}

// Postgres `time` round-trips as "HH:MM:SS"; the <input type="time"> UI works in "HH:MM". Trim to the
// minute for display/equality — the DB coerces "HH:MM" back to time on write.
export function toHm(time: string): string {
  return time.slice(0, 5)
}

export function mapAvailabilityRow(row: AvailabilityRow): AvailabilityWindow {
  return {
    id: row.id,
    attorneyId: row.attorney_id,
    weekday: row.weekday,
    startTime: toHm(row.start_time),
    endTime: toHm(row.end_time),
  }
}

// Bucket an attorney's windows into 7 days (index = weekday), each sorted by start, for the weekly
// editor grid + the calendar's day columns. Out-of-range weekdays are dropped.
export function groupByWeekday(windows: AvailabilityWindow[]): AvailabilityWindow[][] {
  const days: AvailabilityWindow[][] = [[], [], [], [], [], [], []]
  for (const w of windows) {
    const bucket = days[w.weekday]
    if (bucket) bucket.push(w)
  }
  for (const day of days) day.sort((a, b) => a.startTime.localeCompare(b.startTime))
  return days
}
