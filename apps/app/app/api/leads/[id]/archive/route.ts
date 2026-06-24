import { type NextRequest } from "next/server"

import { apiError, apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { emitLeadEvents, setLeadArchivedViaApi } from "@/lib/leads/mutations"

// node:crypto (key hashing) → Node runtime, not Edge.
export const runtime = "nodejs"

// Public REST archive (spec 26, Phase 2). Key-authed (scope `leads:write`); firm-scoped. Idempotent —
// archiving an already-archived lead is a no-op (returns it, emits nothing). Mirrors setLeadArchived:
// emits lead.archived. Counterpart: POST /api/leads/{id}/unarchive. Returns the updated lead.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withApi(request, "leads:write", async ({ admin, context }) => {
    const { id } = await ctx.params
    const result = await setLeadArchivedViaApi(admin, context.firmId, id, true)
    if (!result.ok) return apiError(result.code, result.message, result.status)

    emitLeadEvents(context.firmId, result.lead.id, result.events)
    return apiJson(result.lead)
  })
}
