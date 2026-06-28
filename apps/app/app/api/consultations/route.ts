import { type NextRequest } from "next/server"

import { readJsonObject } from "@/lib/api/body"
import { getApiConsultationsPage, type ConsultationFilters } from "@/lib/api/consultations-query"
import { apiError, apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { parseIdempotencyKey } from "@/lib/api/idempotency"
import { decodeCursor, parseLimit } from "@/lib/api/pagination"
import { tenantScoped } from "@/lib/api/tenant-db"
import { createConsultationViaApi, emitConsultationEvents } from "@/lib/consultations/api-mutations"
import type { Json } from "@/lib/supabase/database.types"

// node:crypto (key hashing) → Node runtime, not Edge.
export const runtime = "nodejs"

// Public REST list (spec 13 + 26). Key-authed (scope `consultations:read`); firm-scoped; newest-first;
// paginated (?limit, ?cursor) and filterable (?attorney, ?lead, ?status, ?archived). The handler does
// only parse + query + serialize — auth / version / rate-limit / errors live in withApi.
export async function GET(request: NextRequest) {
  return withApi(request, "consultations:read", async ({ admin, context }) => {
    const params = request.nextUrl.searchParams
    const limit = parseLimit(params.get("limit"))

    const rawCursor = params.get("cursor")
    const cursor = decodeCursor(rawCursor)
    if (rawCursor && !cursor) {
      return apiError("invalid_cursor", "The cursor is invalid.", 400)
    }

    const filters: ConsultationFilters = {
      attorney: params.get("attorney") ?? undefined,
      lead: params.get("lead") ?? undefined,
      status: params.get("status") ?? undefined,
      archived: params.get("archived") ?? undefined,
    }

    const page = await getApiConsultationsPage(tenantScoped(admin, context.firmId), limit, cursor, filters)
    return apiJson(page)
  })
}

// Public REST book (spec 13 + 26). Key-authed (scope `consultations:write`); firm-scoped. Books a
// consultation into an attorney's free slot — the atomic api_book_consultation RPC validates the attorney,
// lead, office hours, and time-off, and the DB exclusion constraint guarantees no double-book (→ 409). An
// optional Idempotency-Key makes a retry safe: a repeat with the same key replays the original 201.
// Returns the booked consultation (201) and emits `consultation.booked`.
export async function POST(request: NextRequest) {
  return withApi(request, "consultations:write", async ({ admin, context }) => {
    // Optional Idempotency-Key: dedup is enforced ATOMICALLY by the DB (api_book_consultation) — a repeat
    // with the same key returns the original consult, and a failed booking leaves no reservation. We only
    // validate the header's length here.
    const idem = parseIdempotencyKey(request.headers.get("idempotency-key"))
    if (!idem.ok) return apiError("invalid_request", "Idempotency-Key is too long.", 400)

    const body = await readJsonObject(request)
    if (!body.ok) return apiError(body.code, body.message, body.status)

    const result = await createConsultationViaApi(
      admin,
      context.firmId,
      {
        leadId: body.value.lead_id,
        attorneyId: body.value.attorney_id,
        type: body.value.type,
        startAt: body.value.start_at,
        durationMin: body.value.duration_min,
        timeZone: body.value.time_zone,
        paid: body.value.paid,
        amount: body.value.amount,
        data: body.value.data,
      },
      idem.key ? { apiKeyId: context.keyId, key: idem.key } : undefined,
    )
    if (!result.ok) return apiError(result.code, result.message, result.status)

    // `events` is empty on an idempotent replay, so a repeat emits nothing (no duplicate booked event).
    emitConsultationEvents(context.firmId, result.consultation.id, result.events)
    return apiJson(result.consultation as unknown as Json, 201)
  })
}
