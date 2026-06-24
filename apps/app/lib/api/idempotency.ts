// Idempotency-Key replay for API-key creates (spec 26: "Idempotency (writes)"). A client may send an
// `Idempotency-Key` header on POST /api/leads; a repeat with the SAME key (per firm + key) returns the
// ORIGINAL stored response instead of creating a second lead — the direct-create analogue of
// ingestion's externalId idempotency. Backed by api_idempotency_keys (0036), reached via the
// service-role admin client (the API authenticates a key, no user session → RLS does not apply, so
// firm_id is scoped EXPLICITLY here).
//
// Scope (documented): this guarantees idempotency for SEQUENTIAL retries — the real use case (a client
// re-sends after a network timeout, unsure the first attempt landed) — by storing the first result and
// replaying it. Two TRULY-CONCURRENT requests with the same key can each create a lead before either
// stores its row; the unique constraint then makes both callers converge on ONE replayed response, but
// the loser's lead row may persist (a rare extra row, not a wrong response). A reservation protocol to
// close that window is a possible follow-up; it's out of scope for Phase 2.
import type { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"

type Admin = ReturnType<typeof createAdminClient>

// Bound the header so a hostile client can't store megabytes keyed off one create. 255 covers any
// reasonable UUID/ULID/opaque token; longer is rejected by the route as a 400.
export const MAX_IDEMPOTENCY_KEY_LENGTH = 255

export type StoredResponse = { status: number; body: Json }

// Look up a prior result for (firm, key, idempotencyKey). Returns the stored {status, body} to
// replay, or null if this is the first time we've seen the key. Throws on a real lookup error so the
// route can surface a 503 (a blip must not silently fall through to a duplicate create).
export async function findIdempotentResponse(
  admin: Admin,
  firmId: string,
  apiKeyId: string,
  idempotencyKey: string,
): Promise<StoredResponse | null> {
  const { data, error } = await admin
    .from("api_idempotency_keys")
    .select("response_status, response_body")
    .eq("firm_id", firmId)
    .eq("api_key_id", apiKeyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (error) throw new Error("idempotency_lookup_failed")
  if (!data) return null
  return { status: data.response_status, body: data.response_body }
}

// Persist the outcome of a create so a later repeat replays it. Returns the response to send: the one
// just produced, UNLESS a concurrent request won the unique (firm, key, idempotencyKey) race
// (Postgres 23505) — then we re-read and replay the winner's stored response, so two racing repeats
// converge on ONE created lead. Never throws: a store/log failure must not fail a create that already
// succeeded (the caller still gets its result; the next repeat just won't be deduped).
export async function storeIdempotentResponse(
  admin: Admin,
  args: {
    firmId: string
    apiKeyId: string
    idempotencyKey: string
    leadId: string | null
    status: number
    body: Json
  },
): Promise<StoredResponse> {
  const fallback: StoredResponse = { status: args.status, body: args.body }
  try {
    const { error } = await admin.from("api_idempotency_keys").insert({
      firm_id: args.firmId,
      api_key_id: args.apiKeyId,
      idempotency_key: args.idempotencyKey,
      lead_id: args.leadId,
      response_status: args.status,
      response_body: args.body,
    })
    if (error) {
      if (error.code === "23505") {
        // Lost the race: another in-flight repeat already stored its result. Replay THAT one so both
        // callers see the same lead (our own create is the duplicate to discard).
        const winner = await findIdempotentResponse(admin, args.firmId, args.apiKeyId, args.idempotencyKey)
        if (winner) return winner
      }
      console.error("idempotency store failed:", error.message)
    }
  } catch (err) {
    console.error("idempotency store threw:", err)
  }
  return fallback
}
