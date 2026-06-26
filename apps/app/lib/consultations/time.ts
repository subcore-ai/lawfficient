// Timezone helpers for consultations. A <input type="datetime-local"> yields a NAIVE wall-clock string
// (no zone); the column is `timestamptz`. Without converting, Postgres reads the wall time in the
// server's zone and the appointment drifts. We convert the wall time, interpreted in the chosen IANA
// zone, to a UTC instant before storing.

// ms that `timeZone` is ahead of UTC at the given instant (negative across the Americas).
function zoneOffsetMs(timeZone: string, utcMs: number): number {
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
  const asTz = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return asTz - utcMs
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
  let offset: number
  try {
    offset = zoneOffsetMs(timeZone, guess)
  } catch {
    return null // invalid IANA zone
  }
  if (!Number.isFinite(offset)) return null
  return new Date(guess - offset).toISOString()
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
