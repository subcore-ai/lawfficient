import { type NextRequest } from "next/server"

import { getApiAttorneys } from "@/lib/api/attorneys-query"
import { apiJson } from "@/lib/api/errors"
import { withApi } from "@/lib/api/handler"
import { tenantScoped } from "@/lib/api/tenant-db"

// node:crypto (key hashing in auth) → Node runtime, not Edge.
export const runtime = "nodejs"

// Public REST list (spec 26). Key-authed (scope `consultations:read`); firm-scoped. Lists the firm's
// schedulable, active attorneys so an integration can resolve a display name to the staff UUID that
// POST /api/consultations requires as `attorney_id` — there is no other way to discover it. Each row
// carries `has_office_hours`; `?has_office_hours=true` narrows to attorneys who actually have office
// hours configured (booking any other one fails `outside_office_hours`). The set is small and
// bounded, so the listing is unpaginated (`next_cursor` always null). The handler does only
// parse + query + serialize — auth / version / rate-limit / errors live in withApi.
export async function GET(request: NextRequest) {
  return withApi(request, "consultations:read", async ({ admin, context }) => {
    // Opt-in filter; any value other than "true" (absent, "false", …) lists all
    // schedulable attorneys, matching the `?archived` convention on consultations.
    const hasOfficeHours = request.nextUrl.searchParams.get("has_office_hours") === "true"
    const page = await getApiAttorneys(tenantScoped(admin, context.firmId), { hasOfficeHours })
    return apiJson(page)
  })
}
