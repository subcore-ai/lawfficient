import { type NextRequest } from "next/server"

import { getApiAttorneys } from "@/lib/api/attorneys-query"
import { apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { tenantScoped } from "@/lib/api/tenant-db"

// node:crypto (key hashing in auth) → Node runtime, not Edge.
export const runtime = "nodejs"

// Public REST list (spec 26). Key-authed (scope `consultations:read`); firm-scoped. Lists the firm's
// schedulable, active attorneys so an integration can resolve a display name to the staff UUID that
// POST /api/consultations requires as `attorney_id` — there is no other way to discover it. The set
// is small and bounded, so the listing is unpaginated (`next_cursor` always null). The handler does
// only query + serialize — auth / version / rate-limit / errors live in withApi.
export async function GET(request: NextRequest) {
  return withApi(request, "consultations:read", async ({ admin, context }) => {
    const page = await getApiAttorneys(tenantScoped(admin, context.firmId))
    return apiJson(page)
  })
}
