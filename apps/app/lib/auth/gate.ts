// Permission gate for server actions. Mutating actions funnel through requirePermission to reject
// signed-out callers and users missing the action's permission with a clean message before touching
// the DB. RLS (authorize(...), firm-scoped) is the real enforcement; this is the fast, friendly
// pre-check. The resolved user rides along (gate.user) so the action can stamp firm_id / audit rows.
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import type { AppPermission } from "@/lib/rbac/permissions"

export type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }

// `resource` fills the denial message: "You don't have permission to manage <resource>."
export async function requirePermission(permission: AppPermission, resource: string): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!(user.permissions?.includes(permission) ?? false))
    return { ok: false, error: `You don't have permission to manage ${resource}.` }
  // Guard the tenant id: a nullish firmId makes PostgREST silently drop a `.eq("firm_id", …)` filter
  // (fail-open cross-tenant reads), so reject here before any action runs a firm-scoped query.
  if (!user.firmId) return { ok: false, error: "Your session is missing firm context." }
  return { ok: true, user }
}
