import { type NextRequest } from "next/server"

import { apiError, apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { emitLeadEvents, setLeadArchivedViaApi } from "@/lib/leads/mutations"

// node:crypto (key hashing) → Node runtime, not Edge.
export const runtime = "nodejs"

// Public REST unarchive/restore (spec 26, Phase 2). Key-authed (scope `leads:write`); firm-scoped.
// Idempotent — restoring an already-active lead is a no-op (returns it, emits nothing). Mirrors
// setLeadArchived's restore: a restore is a generic state change → emits lead.updated (there's no
// dedicated unarchive event). Counterpart: POST /api/leads/{id}/archive. Returns the updated lead.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withApi(request, "leads:write", async ({ admin, context }) => {
    const { id } = await ctx.params
    const result = await setLeadArchivedViaApi(admin, context.firmId, id, false)
    if (!result.ok) return apiError(result.code, result.message, result.status)

    emitLeadEvents(context.firmId, result.lead.id, result.events)
    return apiJson(result.lead)
  })
}
