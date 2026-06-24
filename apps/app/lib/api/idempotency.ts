// Idempotency-Key for API-key creates (spec 26: "Idempotency (writes)"). A client may send an
// `Idempotency-Key` header on POST /api/leads; a repeat with the SAME key (per firm + key) returns the
// ORIGINAL lead instead of creating a second — the direct-create analogue of ingestion's externalId
// idempotency.
//
// The dedup is enforced ATOMICALLY in the database: the `api_create_lead` function (migration 0036)
// inserts the lead AND records its key in ONE transaction. So a committed key always points at a real
// lead, and a create that fails for any reason rolls back completely — there is no pending/half-written
// reservation to wedge a retry (409) or to later stale-reclaim into a duplicate. Concurrent repeats
// serialize on the unique (firm, key, idempotency_key) constraint; the losers replay the winner's lead.
//
// This module therefore only parses + bounds the header — the heavy lifting lives in SQL and in
// createLeadViaApi (which calls the function and, on a replay, emits no second lead.created).

// Bound the header so a hostile client can't store megabytes keyed off one create. 255 covers any
// reasonable UUID/ULID/opaque token; the DB CHECK in 0036 backstops it.
export const MAX_IDEMPOTENCY_KEY_LENGTH = 255

export type ParsedIdempotencyKey =
  | { ok: true; key: string | null } // key === null → none supplied (a normal, non-idempotent create)
  | { ok: false } // present but invalid (over-long) → the route returns 400

// Parse the optional Idempotency-Key header: trim, treat empty/whitespace as absent, reject over-long.
export function parseIdempotencyKey(header: string | null | undefined): ParsedIdempotencyKey {
  const key = header?.trim() || null
  if (key && key.length > MAX_IDEMPOTENCY_KEY_LENGTH) return { ok: false }
  return { ok: true, key }
}
