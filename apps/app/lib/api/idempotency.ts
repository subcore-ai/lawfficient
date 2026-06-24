// Idempotency-Key replay for API-key creates (spec 26: "Idempotency (writes)"). A client may send an
// `Idempotency-Key` header on POST /api/leads; a repeat with the SAME key (per firm + key) returns the
// ORIGINAL result instead of creating a second lead — the direct-create analogue of ingestion's
// externalId idempotency. Backed by api_idempotency_keys (0036), reached via the service-role admin
// client (the API authenticates a key, no user session → RLS does not apply, so firm_id is scoped
// EXPLICITLY here).
//
// RESERVE-FIRST protocol (closes the concurrent-duplicate window):
//   1. reserveIdempotencyKey INSERTs a PENDING row (response null). The unique (firm, key, idemKey)
//      constraint makes exactly ONE of N concurrent requests the winner — only the winner creates.
//   2. The winner runs the create, then completeIdempotencyKey fills the row in for later replay.
//   3. A repeat that finds a COMPLETED row replays it; one that finds a still-PENDING reservation
//      gets `pending` (the route → 409, a request with that key is in flight).
//   4. releaseIdempotencyKey clears a pending reservation if the create itself failed, so the client
//      can retry the same key with a corrected request rather than being wedged on 409.
import type { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"

type Admin = ReturnType<typeof createAdminClient>

// Bound the header so a hostile client can't store megabytes keyed off one create. 255 covers any
// reasonable UUID/ULID/opaque token; longer is rejected by the route as a 400 (and the DB CHECK in
// 0036 backstops it).
export const MAX_IDEMPOTENCY_KEY_LENGTH = 255

// A create + complete runs within one request (seconds). A reservation still PENDING after this long
// means the holder died before completing (e.g. its completion update failed) — a later request
// reclaims the slot so the key isn't wedged on 409 forever.
const STALE_RESERVATION_MS = 60_000

function requireFirmId(firmId: string): void {
  if (!firmId) throw new Error("firmId is required")
}

export type ReserveResult =
  | { kind: "reserved" } // we own the key — create the lead, then complete
  | { kind: "replay"; status: number; body: Json } // a prior COMPLETED result — replay it verbatim
  | { kind: "pending" } // another request holds the key and is still in flight → the route 409s

// Claim (firm, key, idemKey) by inserting a pending reservation, or report the existing holder's
// state. Throws on a real insert/lookup error so the route surfaces a 503 (a blip must NOT fall
// through to a duplicate create).
export async function reserveIdempotencyKey(
  admin: Admin,
  firmId: string,
  apiKeyId: string,
  idempotencyKey: string,
): Promise<ReserveResult> {
  requireFirmId(firmId)
  const { error } = await admin.from("api_idempotency_keys").insert({
    firm_id: firmId,
    api_key_id: apiKeyId,
    idempotency_key: idempotencyKey,
    response_status: null,
    response_body: null,
  })
  if (!error) return { kind: "reserved" }
  if (error.code !== "23505") throw new Error("idempotency_reserve_failed")

  // Lost the race (or a later repeat): read the holder's row.
  const { data, error: readErr } = await admin
    .from("api_idempotency_keys")
    .select("response_status, response_body, created_at")
    .eq("firm_id", firmId)
    .eq("api_key_id", apiKeyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (readErr) throw new Error("idempotency_lookup_failed")
  if (!data) return { kind: "pending" } // released mid-race → the client retries
  if (data.response_status !== null && data.response_body !== null) {
    return { kind: "replay", status: data.response_status, body: data.response_body }
  }
  // Still pending. If it predates what a create+complete could take, the holder died before
  // completing — reclaim the slot so the key isn't wedged on 409 forever.
  if (Date.now() - new Date(data.created_at).getTime() <= STALE_RESERVATION_MS) return { kind: "pending" }
  await admin
    .from("api_idempotency_keys")
    .delete()
    .eq("firm_id", firmId)
    .eq("api_key_id", apiKeyId)
    .eq("idempotency_key", idempotencyKey)
    .is("response_status", null)
  const retry = await admin.from("api_idempotency_keys").insert({
    firm_id: firmId,
    api_key_id: apiKeyId,
    idempotency_key: idempotencyKey,
    response_status: null,
    response_body: null,
  })
  // Won the reclaim → we own it; another reclaimer beat us → still pending.
  return retry.error ? { kind: "pending" } : { kind: "reserved" }
}

// Fill a reservation in with the produced result so a later repeat replays it. Best-effort: a store
// failure must not fail a create that already succeeded (the next repeat just won't dedupe).
export async function completeIdempotencyKey(
  admin: Admin,
  args: {
    firmId: string
    apiKeyId: string
    idempotencyKey: string
    leadId: string | null
    status: number
    body: Json
  },
): Promise<void> {
  try {
    const { error } = await admin
      .from("api_idempotency_keys")
      .update({ lead_id: args.leadId, response_status: args.status, response_body: args.body })
      .eq("firm_id", args.firmId)
      .eq("api_key_id", args.apiKeyId)
      .eq("idempotency_key", args.idempotencyKey)
    if (error) console.error("idempotency complete failed:", error.message)
  } catch (err) {
    console.error("idempotency complete threw:", err)
  }
}

// Release a still-PENDING reservation when the create itself failed, so the same key can be retried
// (otherwise the pending row would wedge future retries on 409). Only deletes a pending row — never a
// completed one. Best-effort.
export async function releaseIdempotencyKey(
  admin: Admin,
  firmId: string,
  apiKeyId: string,
  idempotencyKey: string,
): Promise<void> {
  try {
    await admin
      .from("api_idempotency_keys")
      .delete()
      .eq("firm_id", firmId)
      .eq("api_key_id", apiKeyId)
      .eq("idempotency_key", idempotencyKey)
      .is("response_status", null)
  } catch (err) {
    console.error("idempotency release threw:", err)
  }
}
