// Timezone helpers for consultations. A <input type="datetime-local"> yields a NAIVE wall-clock string
// (no zone); the column is `timestamptz`. Without converting, Postgres reads the wall time in the
// server's zone and the appointment drifts. We convert the wall time, interpreted in the chosen IANA
// zone, to a UTC instant before storing.

// The wall clock shown in `timeZone` at instant `utcMs`, expressed as a UTC-epoch ms — so two wall
// clocks can be compared/subtracted directly.
function zoneWallMs(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
}

// ms that `timeZone` is ahead of UTC at the given instant (negative across the Americas).
function zoneOffsetMs(timeZone: string, utcMs: number): number {
  return zoneWallMs(timeZone, utcMs) - utcMs
}

// Convert "YYYY-MM-DDTHH:mm[:ss]" interpreted in `timeZone` to a UTC ISO instant. Returns null on a
// malformed wall string or an invalid IANA zone (the caller rejects). Single-offset correction — exact
// except within the ~1h DST-transition window, which is acceptable for booking wall times.
export function zonedWallTimeToUtcISO(wall: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(wall)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const mi = Number(m[5])
  const s = Number(m[6] ?? "0")
  const guess = Date.UTC(y, mo - 1, d, h, mi, s)
  // Reject out-of-range components (e.g. month 13, day 32, Feb 30) rather than letting Date.UTC
  // silently roll them over into a different — unintended — date/time.
  const back = new Date(guess)
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d ||
    back.getUTCHours() !== h ||
    back.getUTCMinutes() !== mi ||
    back.getUTCSeconds() !== s
  ) {
    return null
  }
  let offset: number
  try {
    offset = zoneOffsetMs(timeZone, guess)
    // Re-evaluate the offset at the first-pass instant: near a DST change the offset at `guess`
    // (wall-as-UTC) can differ from the offset at the true instant. One correction pass fixes all
    // non-gap wall times (e.g. an afternoon on a spring-forward/fall-back day).
    offset = zoneOffsetMs(timeZone, guess - offset)
  } catch {
    return null // invalid IANA zone
  }
  if (!Number.isFinite(offset)) return null
  const result = guess - offset
  // Reject a NONEXISTENT wall time (the spring-forward gap, e.g. 02:30 on a spring-forward day): round
  // the instant back to its wall clock in the zone; if it doesn't match the requested wall time, that
  // wall time never occurs — so don't silently book an off-by-an-hour instant.
  if (zoneWallMs(timeZone, result) !== guess) return null
  return new Date(result).toISOString()
}

// A stored UTC instant → the "YYYY-MM-DDTHH:mm" wall-clock string in `timeZone` — the inverse of
// zonedWallTimeToUtcISO, for seeding a <input type="datetime-local"> (which wants a naive local time).
// Returns "" on a bad instant/zone, so the input just renders empty.
export function utcToZonedInput(iso: string, timeZone: string): string {
  if (!iso) return "" // new Date(null | "") is the Unix epoch, not invalid — guard so it doesn't format 1970
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(iso))
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
    const value = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
    // A well-formed datetime-local value is exactly this shape; "" otherwise.
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value : ""
  } catch {
    return ""
  }
}

// Render a stored UTC instant in the consultation's own zone (so a New-York consult shows the New-York
// wall time + abbreviation, not the server/UTC clock). Falls back to the raw ISO on a bad zone.
export function formatConsultationWhen(iso: string, timeZone: string): string {
  try {
    // Explicit component options — NOT dateStyle/timeStyle, which can't be combined with timeZoneName
    // (that throws, silently dropping us to the raw-ISO fallback so the zone never shows).
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// Whether `value` is a valid IANA time-zone name (cheap Intl probe).
export function isValidTimeZone(value: string): boolean {
  if (!value) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

// Split a naive "YYYY-MM-DDTHH:mm" wall string into separate date + time parts, for distinct day / time
// inputs. Returns empty strings when the input is malformed (so the inputs render empty).
export function splitWall(wall: string): { day: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(wall)
  return m ? { day: m[1]!, time: m[2]! } : { day: "", time: "" }
}

// "HH:mm" shifted by `minutes`, clamped to the same day [00:00, 23:59]. "" when the time is malformed.
// Used to derive the "to" time from the "from" time + a consultation type's default length.
export function addMinutesToTime(time: string, minutes: number): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time)
  if (!m) return ""
  const total = Math.max(0, Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + minutes))
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

// Minutes from `from` to `to` ("HH:mm" each). Negative or 0 when `to` isn't after `from`; NaN if malformed.
// The booking form derives the duration from the from/to selection instead of a manual field.
export function minutesBetween(from: string, to: string): number {
  const a = /^(\d{2}):(\d{2})$/.exec(from)
  const b = /^(\d{2}):(\d{2})$/.exec(to)
  if (!a || !b) return NaN
  return Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]))
}

// Today's calendar date (YYYY-MM-DD) in `timeZone` — for comparing against firm-calendar `date` columns
// (e.g. the time-off cutoff). en-CA renders ISO-style; falls back to UTC on a bad zone.
export function currentDateInZone(timeZone: string): string {
  const opts = { year: "numeric", month: "2-digit", day: "2-digit" } as const
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, ...opts }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...opts }).format(new Date())
  }
}
