// Shared input validators for the public API (spec 26). Values that reach the query layer as raw
// strings — UUID path/query params (they hit uuid columns) and the opaque cursor's fields (they
// interpolate into a PostgREST `.or(...)` keyset filter) — are validated here FIRST, so a malformed
// value is a clean 4xx instead of a 500 (uuid cast error) or a filter-injection vector.

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

// Strict-ish ISO-8601 instant — the shape Postgres `timestamptz` serializes to in JSON
// (`YYYY-MM-DDThh:mm:ss[.ffffff][Z|±hh[:mm]]`). Tolerant on the fractional seconds and the offset
// form (so it never rejects a real `created_at`), but it still requires the date+time skeleton and
// admits ONLY `[0-9 T : . + - Z]`, so the cursor's createdAt can't smuggle `,` `(` `)` `*` or other
// PostgREST filter syntax.
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$/

export function isIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_REGEX.test(value)
}
