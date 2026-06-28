// Shared consultation-write core for the public API (spec 13 + 26), mirroring lib/leads/mutations.ts.
// The booking RULES live in SQL (api_book_consultation / api_update_consultation, migration 0049) so the
// API and the in-app Server Actions can't diverge and the no-double-book guard is race-proof. This module
// is the thin admin-client adapter the API routes call: validate the request, invoke the RPC, translate
// its Postgres error codes into the standard envelope, and emit the matching consultation.* webhook event.
//
// The API authenticates a KEY (no user session → RLS does not apply), so every call uses the service-role
// admin client and scopes firm_id EXPLICITLY (and asserts it), the same fail-safe discipline as leads.
import { after } from "next/server"

import { getApiConsultationById } from "@/lib/api/consultations-query"
import type { ApiConsultation } from "@/lib/api/consultations"
import { tenantScoped } from "@/lib/api/tenant-db"
import { isUuid } from "@/lib/api/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database, Json } from "@/lib/supabase/database.types"
import { emitEvent } from "@/lib/webhooks/emit"
import type { WebhookEventType } from "@/lib/webhooks/events"
import { parseConsultationInput, parseConsultationPatch } from "./validation"

type Admin = ReturnType<typeof createAdminClient>

// The admin client bypasses RLS, so every call below scopes firm_id EXPLICITLY. Guard it: an
// empty/undefined firmId would make `.eq("firm_id", …)` drop the predicate and touch other firms' rows.
// Callers pass a key-derived id, so this never fires in practice; it's the unconditional backstop.
function requireFirmId(firmId: string): void {
  if (!firmId) throw new Error("firmId is required")
}

export type ConsultationMutationResult =
  | { ok: true; consultation: ApiConsultation; events: WebhookEventType[] }
  | { ok: false; status: number; code: string; message: string }

// ── Shared emission ───────────────────────────────────────────────────────────────────────────────
// Emit consultation.* events AFTER the response is sent (next/server `after`) so webhook delivery never
// adds latency. Best-effort: loads the consult in the public API shape, delivers via the admin client,
// and NEVER throws — a webhook failure must never fail the write. No-ops on an empty event list.
export function emitConsultationEvents(firmId: string, consultationId: string, types: WebhookEventType[]) {
  if (types.length === 0) return
  if (!firmId) return // best-effort: never run a firm-scoped read without firm context
  after(async () => {
    try {
      const admin = createAdminClient()
      const consult = await getApiConsultationById(tenantScoped(admin, firmId), consultationId)
      if (!consult) return // deleted out from under us, or not this firm's — nothing to emit
      for (const type of types) await emitEvent(admin, firmId, type, consult as unknown as Json)
    } catch (err) {
      console.error("emitConsultationEvents failed:", err)
    }
  })
}

// The row shape both RPCs return (they share the same `returns table (...)`). Derived from the generated
// types so it can't drift from the migration.
type BookedRow = Database["public"]["Functions"]["api_book_consultation"]["Returns"][number]

// Serialize an RPC-returned consult row to the public API shape. The RPC already returns every public
// field in snake_case, so we map straight across — no name lookups needed (the public shape exposes ids,
// not resolved names). firm_id is asserted as a belt-and-braces cross-tenant guard (the write pinned it),
// and is then dropped from the output; booked_by_id is never returned (no leak). `replayed` is internal.
function serializeRpcRow(row: BookedRow, firmId: string): ApiConsultation {
  if (row.firm_id !== firmId) throw new Error("firm_scope_violation")
  return {
    id: row.id,
    lead_id: row.lead_id,
    attorney_id: row.attorney_id,
    type: row.type,
    status: row.status,
    start_at: row.start_at,
    duration_min: row.duration_min,
    time_zone: row.time_zone,
    paid: row.paid,
    amount: row.amount,
    outcome: row.outcome,
    archived: row.archived,
    created_at: row.created_at,
    // jsonb arrives as Json; the public shape is an object map (a primitive/array/null → {}).
    data: row.data && typeof row.data === "object" && !Array.isArray(row.data) ? (row.data as Record<string, Json>) : {},
  }
}

// Map a labeled check_violation raised inside the RPC (api_validate_booking / the booking fn) to a clean
// envelope. The label travels in the Postgres error MESSAGE.
function bookingRuleError(message: string): { status: number; code: string; message: string } | null {
  switch (message) {
    case "lead_not_in_firm":
      return { status: 422, code: "invalid_request", message: "That lead isn't in your firm." }
    case "attorney_not_bookable":
      return {
        status: 422,
        code: "invalid_request",
        message: "That attorney isn't a bookable member of your firm.",
      }
    case "attorney_required":
      return { status: 422, code: "invalid_request", message: "An attorney is required to reschedule." }
    case "outside_office_hours":
      return {
        status: 422,
        code: "outside_office_hours",
        message: "That time is outside the attorney's office hours.",
      }
    case "attorney_unavailable":
      return {
        status: 422,
        code: "attorney_unavailable",
        message: "The attorney is unavailable on that date.",
      }
    default:
      return null
  }
}

export type CreateConsultationApiInput = {
  leadId?: unknown
  attorneyId?: unknown
  type?: unknown
  startAt?: unknown
  durationMin?: unknown
  timeZone?: unknown
  paid?: unknown
  amount?: unknown
  data?: unknown
}

// Book a consultation from a per-firm API key. Validates the core (lead, type, start, duration, tz,
// paid/amount) with the SAME validator the in-app form uses, then calls the atomic api_book_consultation
// RPC. start_at is a real UTC instant (the API is machine-to-machine — no wall-clock conversion). When
// `idempotency` is given, a repeat with the same key replays the original consult (no second event).
export async function createConsultationViaApi(
  admin: Admin,
  firmId: string,
  input: CreateConsultationApiInput,
  idempotency?: { apiKeyId: string; key: string },
): Promise<ConsultationMutationResult> {
  requireFirmId(firmId)

  const core = parseConsultationInput(input)
  if (!core.ok) return { ok: false, status: 422, code: "invalid_request", message: core.error }

  // Booking REQUIRES an attorney (office-hours validation has no meaning without one). The in-app form
  // allows an unassigned consult, but the API's contract is a booked slot, so reject a missing attorney.
  if (!core.value.attorneyId) {
    return { ok: false, status: 422, code: "invalid_request", message: "attorney_id is required." }
  }
  // Both ids hit uuid columns inside the RPC; a non-uuid would 500 on the cast → reject up front.
  if (!isUuid(core.value.leadId)) {
    return { ok: false, status: 422, code: "invalid_request", message: "lead_id must be a UUID." }
  }
  if (!isUuid(core.value.attorneyId)) {
    return { ok: false, status: 422, code: "invalid_request", message: "attorney_id must be a UUID." }
  }

  // `data`, if present, must be a JSON object.
  let data: Json = {}
  if (input.data !== undefined) {
    if (typeof input.data !== "object" || input.data === null || Array.isArray(input.data)) {
      return { ok: false, status: 422, code: "invalid_request", message: "data must be an object." }
    }
    data = input.data as Json
  }

  const { data: rows, error } = await admin.rpc("api_book_consultation", {
    p_firm_id: firmId,
    p_lead_id: core.value.leadId,
    p_attorney_id: core.value.attorneyId,
    p_type: core.value.type,
    p_start_at: core.value.startAt,
    p_duration_min: core.value.durationMin,
    p_time_zone: core.value.timeZone,
    p_paid: core.value.paid,
    // `numeric` is nullable; the generated type marks the (default-less) param as non-null, so cast a
    // genuine null through — an absent amount stores NULL (track-only payment), validated in the RPC test.
    p_amount: core.value.amount as number,
    p_data: data,
    p_api_key_id: idempotency?.apiKeyId,
    p_idempotency_key: idempotency?.key,
  })

  // The 0043 no-overlap exclusion → a clean "slot taken" conflict (never a 500).
  if (error?.code === "23P01") {
    return { ok: false, status: 409, code: "slot_unavailable", message: "That time slot is already booked." }
  }
  // A labeled validation failure from inside the RPC.
  if (error?.code === "23514") {
    const mapped = bookingRuleError(error.message)
    if (mapped) return { ok: false, ...mapped }
  }
  // A wrong-firm / unknown attorney or lead trips the composite FK.
  if (error?.code === "23503") {
    return { ok: false, status: 422, code: "invalid_request", message: "That lead or attorney isn't in your firm." }
  }
  const row = rows?.[0]
  if (error || !row) {
    return { ok: false, status: 500, code: "internal_error", message: "Couldn't book the consultation." }
  }

  const consultation = serializeRpcRow(row, firmId)
  // A replay returns the original consult — don't re-emit consultation.booked for it.
  return { ok: true, consultation, events: row.replayed ? [] : ["consultation.booked"] }
}

// What a PATCH changed → which consultation.* events to emit. Pure for tests. A reschedule (any slot /
// attorney field, or an explicit status='rescheduled') emits consultation.rescheduled; a cancel emits
// consultation.canceled. Other lifecycle moves (completed / no_show) aren't part of the API event
// catalog, so they emit nothing.
export function decideConsultationEvents(opts: {
  rescheduled: boolean
  canceled: boolean
}): WebhookEventType[] {
  const events: WebhookEventType[] = []
  if (opts.canceled) events.push("consultation.canceled")
  else if (opts.rescheduled) events.push("consultation.rescheduled")
  return events
}

// Reschedule and/or cancel a consultation from a per-firm API key. Only the PROVIDED fields are touched
// (start_at / duration_min / attorney_id / time_zone → reschedule; status → lifecycle). The RPC gates the
// change to a non-terminal consult and re-validates a reschedule against the booking rules. A consult
// from another firm — or a finalized one — reads as 404 (never leaked, never silently overwritten).
export async function updateConsultationViaApi(
  admin: Admin,
  firmId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<ConsultationMutationResult> {
  requireFirmId(firmId)
  if (!isUuid(id)) return { ok: false, status: 404, code: "not_found", message: "Consultation not found." }

  // The public body is snake_case; parseConsultationPatch (shared with the in-app form) reads camelCase.
  // Forward only the keys actually PRESENT so an omitted key stays "leave unchanged" (its absence, not a
  // null, is what parseConsultationPatch keys off). The API exposes book/reschedule/cancel, so only the
  // slot fields + status cross over (paid/amount/type/outcome aren't reschedulable here).
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
  const raw: Record<string, unknown> = {}
  if (has("start_at")) raw.startAt = body.start_at
  if (has("duration_min")) raw.durationMin = body.duration_min
  if (has("attorney_id")) raw.attorneyId = body.attorney_id
  if (has("time_zone")) raw.timeZone = body.time_zone
  if (has("status")) raw.status = body.status

  const parsed = parseConsultationPatch(raw)
  if (!parsed.ok) return { ok: false, status: 422, code: "invalid_request", message: parsed.error }
  const patch = parsed.value

  // A reschedule = any slot/attorney field is present. (paid/amount/outcome aren't reschedulable via this
  // endpoint — they're in-app concerns; the API surface is book / reschedule / cancel.)
  const rescheduling =
    patch.startAt !== undefined ||
    patch.durationMin !== undefined ||
    patch.attorneyId !== undefined ||
    patch.timeZone !== undefined

  // The only lifecycle move the API exposes is cancel. Reject other terminal moves (completed / no_show)
  // — those are in-app outcomes, not API mutations — so the contract stays book / reschedule / cancel.
  if (patch.status !== undefined && patch.status !== "canceled") {
    return {
      ok: false,
      status: 422,
      code: "invalid_request",
      message: "status can only be set to 'canceled' via the API.",
    }
  }
  const canceling = patch.status === "canceled"

  // Reschedule and cancel are distinct API operations; combining them is ambiguous (you don't move a
  // consult you're canceling) and would make the cancel needlessly re-validate the new slot. Reject it.
  if (rescheduling && canceling) {
    return {
      ok: false,
      status: 422,
      code: "invalid_request",
      message: "Reschedule and cancel can't be combined in one request.",
    }
  }

  if (!rescheduling && !canceling) {
    return { ok: false, status: 422, code: "invalid_request", message: "Nothing to update." }
  }

  // attorney_id, when provided, must be a uuid or null (it hits the uuid column inside the RPC).
  if (patch.attorneyId && !isUuid(patch.attorneyId)) {
    return { ok: false, status: 422, code: "invalid_request", message: "attorney_id must be a UUID." }
  }

  const { data: rows, error } = await admin.rpc("api_update_consultation", {
    p_firm_id: firmId,
    p_id: id,
    p_attorney_id: patch.attorneyId ?? undefined,
    p_start_at: patch.startAt ?? undefined,
    p_duration_min: patch.durationMin ?? undefined,
    p_time_zone: patch.timeZone ?? undefined,
    p_status: canceling ? "canceled" : undefined,
    p_reschedule: rescheduling,
  })

  if (error?.code === "23P01") {
    return { ok: false, status: 409, code: "slot_unavailable", message: "That time slot is already booked." }
  }
  if (error?.code === "23514") {
    const mapped = bookingRuleError(error.message)
    if (mapped) return { ok: false, ...mapped }
  }
  if (error?.code === "23503") {
    return { ok: false, status: 422, code: "invalid_request", message: "That attorney isn't in your firm." }
  }
  if (error) {
    return { ok: false, status: 500, code: "internal_error", message: "Couldn't update the consultation." }
  }
  // No row returned → the consult doesn't exist, isn't this firm's, or is already finalized. The RPC
  // can't tell us which without leaking; 404 is the safe, non-enumerating answer (mirrors leads).
  const row = rows?.[0]
  if (!row) return { ok: false, status: 404, code: "not_found", message: "Consultation not found." }

  const consultation = serializeRpcRow(row, firmId)
  const events = decideConsultationEvents({ rescheduled: rescheduling, canceled: canceling })
  return { ok: true, consultation, events }
}
