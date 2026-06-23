// Server-side session helpers. Feature code should resolve the current user
// through these so role + firm scoping stay consistent everywhere.
import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import type { AppPermission } from "@/lib/rbac/permissions"
import type { Role } from "@/data/types"

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: Role
  firmId: string
  podId: string | null
  // RBAC permissions from the access-token hook; null until the hook is live.
  permissions: AppPermission[] | null
}

// Returns the signed-in user's firm-scoped profile, or null when not
// authenticated (or while Supabase isn't configured yet).
async function loadCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  // getClaims() VERIFIES the JWT and reads its claims locally — with asymmetric signing keys there's
  // no auth-server round-trip. The proxy (lib/supabase/proxy.ts) already did the authoritative
  // getUser() validation + session refresh for this request, so here we only read the verified claims:
  // the user id (sub) AND the access-token claims, including the permissions stamped in by the
  // access-token hook (app_metadata.permissions) — so no separate getUser()/getSession() is needed.
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null
  const claims = data.claims

  // Only active staff are authenticated. A disabled (or not-yet-activated)
  // profile resolves to no row → null → the app shell redirects to /login,
  // even though Supabase Auth may still accept the credentials.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, email, name, role, firm_id, pod_id")
    .eq("id", claims.sub)
    .eq("status", "active")
    .single()

  // Cast: column-level types arrive once database.types.ts is regenerated.
  const profile = profileRow as {
    id: string
    email: string
    name: string
    role: string
    firm_id: string
    pod_id: string | null
  } | null
  if (!profile) return null

  // Permissions live in the verified token's app_metadata (the access-token hook stamps them in).
  // Absent (null) until the hook is live, which signals callers to fall back to the role matrix.
  const perms = (claims.app_metadata as { permissions?: unknown } | undefined)
    ?.permissions
  const permissions = Array.isArray(perms) ? (perms as AppPermission[]) : null

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as Role,
    firmId: profile.firm_id,
    podId: profile.pod_id,
    permissions,
  }
}

// Memoized per request with React `cache()` so the (app) layout, each page's loader, and any other
// server component that needs the user share ONE claims read + profile query — instead of repeating
// them at every call site in a render. The authoritative auth-server round-trip stays in the proxy
// (getUser); getClaims() here verifies the JWT locally.
export const getCurrentUser = cache(loadCurrentUser)
