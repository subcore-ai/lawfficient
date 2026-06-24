// Cursor-based pagination for list endpoints (spec 26). `?limit` defaults to 50, max 200
// (clamped, never rejected). The cursor is OPAQUE to clients — base64url of the last row's
// `created_at` + `id` — so the ordering key stays an implementation detail and ties never
// straddle a page boundary (the keyset filter compares the pair, not just the timestamp).
// Responses are `{ "data": [...], "next_cursor": string | null }`.
export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

// Clamp `?limit` to [1, MAX_LIMIT]; a missing / non-numeric / non-positive value → DEFAULT_LIMIT.
export function parseLimit(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_LIMIT
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT
  return Math.min(Math.floor(n), MAX_LIMIT)
}

export type Cursor = { createdAt: string; id: string }

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, "utf8").toString("base64url")
}

// Decode an opaque cursor; returns null for any malformed value so a bad `?cursor` is a clean
// 400 at the call site rather than a crash.
export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null
  let decoded: string
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8")
  } catch {
    return null
  }
  const sep = decoded.indexOf("|")
  if (sep === -1) return null
  const createdAt = decoded.slice(0, sep)
  const id = decoded.slice(sep + 1)
  if (!createdAt || !id) return null
  return { createdAt, id }
}

export type Page<T> = { data: T[]; next_cursor: string | null }

// Shape a fetched window into the response envelope. The handler fetches `limit + 1` rows to
// detect a further page: if it got the extra row, drop it and emit a cursor from the last KEPT
// row (via `toCursor`); otherwise this is the last page (`next_cursor: null`).
export function buildPage<T>(rows: T[], limit: number, toCursor: (row: T) => Cursor): Page<T> {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const last = data[data.length - 1]
  return {
    data,
    next_cursor: hasMore && last ? encodeCursor(toCursor(last)) : null,
  }
}
