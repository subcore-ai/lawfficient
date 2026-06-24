import { type NextRequest } from "next/server"

import { apiError, apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { getApiLeadById } from "@/lib/api/leads-query"
import { tenantScoped } from "@/lib/api/tenant-db"

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
