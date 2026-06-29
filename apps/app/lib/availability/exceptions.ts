// Time-off / unavailability view model (migration 0044). Per-attorney full-day exceptions: a date inside
// any range removes the attorney's whole day from the calendar. Pure + unit-tested.
import type { Database } from "@/lib/supabase/database.types"

type ExceptionRow = Database["public"]["Tables"]["availability_exceptions"]["Row"]

export type TimeOff = {
  id: string
  attorneyId: string | null // null = a firm-wide holiday (closes the date for every attorney)
  startDate: string // YYYY-MM-DD (inclusive)
  endDate: string // YYYY-MM-DD (inclusive)
}

export function mapExceptionRow(row: ExceptionRow): TimeOff {
  return {
    id: row.id,
    attorneyId: row.attorney_id,
    startDate: row.start_date,
    endDate: row.end_date,
  }
}

// True only for a real calendar date — the regex alone would accept e.g. 2026-13-40.
export function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

// A bare off-date range — the minimal shape isDateOff needs, used to thread an attorney's full-day
// unavailability (own time off + firm holidays) to the date pickers without fabricating row ids.
export type OffDateRange = { startDate: string; endDate: string }

// Is `date` (YYYY-MM-DD) inside any exception range? ISO dates compare lexicographically = chronologically,
// so plain string comparison is correct (no Date/tz needed).
export function isDateOff(exceptions: OffDateRange[], date: string): boolean {
  return exceptions.some((e) => date >= e.startDate && date <= e.endDate)
}

export type TimeOffInput = { startDate: string; endDate: string }

// Validate an add-time-off form: two real dates with end >= start.
export function parseTimeOffInput(raw: {
  startDate: FormDataEntryValue | null
  endDate: FormDataEntryValue | null
}): { ok: true; value: TimeOffInput } | { ok: false; error: string } {
  const startDate = typeof raw.startDate === "string" ? raw.startDate.trim() : ""
  const endDate = typeof raw.endDate === "string" ? raw.endDate.trim() : ""
  if (!isValidYmd(startDate) || !isValidYmd(endDate)) return { ok: false, error: "Choose valid start and end dates." }
  if (endDate < startDate) return { ok: false, error: "The end date can't be before the start date." }

  return { ok: true, value: { startDate, endDate } }
}
