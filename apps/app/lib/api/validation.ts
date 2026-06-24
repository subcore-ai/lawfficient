// Shared input validators for the public API (spec 26). Values that reach the query layer as raw
// strings — UUID path/query params (they hit uuid columns) and the opaque cursor's fields (they
// interpolate into a PostgREST `.or(...)` keyset filter) — are validated here FIRST, so a malformed
// value is a clean 4xx instead of a 500 (uuid cast error) or a filter-injection vector.

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

// ISO-8601 instant in the shape Postgres `timestamptz` serializes to in JSON:
// `YYYY-MM-DDThh:mm:ss[.ffffff](Z|±hh:mm)`. The regex fixes the structure and admits ONLY
// `[0-9 T : . + - Z]`, so the cursor's createdAt can't smuggle `,` `(` `)` `*` filter syntax.
const ISO_TIMESTAMP_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/

// True only for a REAL instant. The range + days-in-month checks reject values that match the
// shape but aren't valid dates (month 13, Feb 30, hour 99) — exactly what Postgres rejects — so a
// crafted cursor 4xx's at decode instead of 500-ing later on the timestamptz cast. (`Date.parse`
// is unfit here: it rolls Feb 30 over to Mar 2, which Postgres would still reject.)
export function isIsoTimestamp(value: string): boolean {
  const m = ISO_TIMESTAMP_REGEX.exec(value)
  if (!m) return false
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  const second = Number(m[6])
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false
  // Validate the numeric UTC offset when present (Z carries none). Postgres rejects an out-of-range
  // displacement on the cast, so cap it the way real time zones are (±14:00) — a crafted cursor with
  // `+25:00` 4xx's here instead of 500-ing later.
  if (m[7] !== undefined) {
    const offsetHour = Number(m[7])
    const offsetMinute = Number(m[8])
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute > 0)) return false
  }
  // 0th day of the *next* month (1-based here) = the last day of this month, leap years included.
  const daysInMonth = new Date(Date.UTC(Number(m[1]), month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
}
