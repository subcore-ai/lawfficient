import { type NextRequest } from "next/server"

import { readJsonObject } from "@/lib/api/body"
import { getApiConsultationById } from "@/lib/api/consultations-query"
import { apiError, apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { tenantScoped } from "@/lib/api/tenant-db"
import { emitConsultationEvents, updateConsultationViaApi } from "@/lib/consultations/api-mutations"

// node:crypto (key hashing) → Node runtime, not Edge.
export const runtime = "nodejs"

// Public REST fetch-one (spec 13 + 26). Key-authed (scope `consultations:read`); firm-scoped — a consult
// from another firm reads as 404, never leaked. Next 16: params is async.
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withApi(request, "consultations:read", async ({ admin, context }) => {
    const { id } = await ctx.params
    const consult = await getApiConsultationById(tenantScoped(admin, context.firmId), id)
    if (!consult) return apiError("not_found", "Consultation not found.", 404)
    return apiJson(consult)
  })
}

// Public REST reschedule / cancel (spec 13 + 26). Key-authed (scope `consultations:write`); firm-scoped.
// Reschedule by sending any of start_at / duration_min / attorney_id / time_zone (re-validated against the
// attorney's office hours + time-off, and the no-double-book guard → 409 on a clash); cancel by sending
// status: "canceled". Only a non-terminal consult can change; a finalized or other-firm consult returns
// 404. Returns the updated consult and emits `consultation.rescheduled` / `consultation.canceled`.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withApi(request, "consultations:write", async ({ admin, context }) => {
    const { id } = await ctx.params
    const body = await readJsonObject(request)
    if (!body.ok) return apiError(body.code, body.message, body.status)

    const result = await updateConsultationViaApi(admin, context.firmId, id, body.value)
    if (!result.ok) return apiError(result.code, result.message, result.status)

    emitConsultationEvents(context.firmId, result.consultation.id, result.events)
    return apiJson(result.consultation)
  })
}
