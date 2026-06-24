import { type NextRequest } from "next/server"

import { readJsonObject } from "@/lib/api/body"
import { apiError, apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { getApiLeadById } from "@/lib/api/leads-query"
import { tenantScoped } from "@/lib/api/tenant-db"
import { emitLeadEvents, updateLeadViaApi } from "@/lib/leads/mutations"

// node:crypto (key hashing) → Node runtime, not Edge.
export const runtime = "nodejs"

// Public REST fetch-one (spec 26, Phase 1). Key-authed (scope `leads:read`); firm-scoped — a
// lead from another firm reads as 404, never leaked. Next 16: params is async.
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withApi(request, "leads:read", async ({ admin, context }) => {
    const { id } = await ctx.params
    const lead = await getApiLeadById(tenantScoped(admin, context.firmId), id)
    if (!lead) return apiError("not_found", "Lead not found.", 404)
    return apiJson(lead)
  })
}

// Public REST partial update (spec 26, Phase 2). Key-authed (scope `leads:write`); firm-scoped. Only
// the fields PRESENT in the body are touched (first_name, last_name, phone, email, source,
// assignee_id, status by its firm-defined key, and `data`), validated by the SAME rules the Server
// Actions use (the shared lib/leads core). Returns the updated lead; emits lead.updated /
// lead.status_changed / lead.assigned to match exactly what changed.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withApi(request, "leads:write", async ({ admin, context }) => {
    const { id } = await ctx.params
    const body = await readJsonObject(request)
    if (!body.ok) return apiError(body.code, body.message, body.status)

    const result = await updateLeadViaApi(admin, context.firmId, id, body.value)
    if (!result.ok) return apiError(result.code, result.message, result.status)

    // Best-effort + non-blocking: delivered via next/server `after` (the same path the app uses).
    emitLeadEvents(context.firmId, result.lead.id, result.events)
    return apiJson(result.lead)
  })
}
