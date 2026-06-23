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

// The access-token hook writes permissions into the JWT claims, not the database
// app_metadata that getUser() returns. Decode the (already-validated) access token to
// read them. Only the access_token is touched — never the unvalidated session user — so
// this stays sound. Null when absent (hook not live) → callers fall back to the matrix.
function permissionsFromAccessToken(accessToken: string | undefined): AppPermission[] | null {
  const segment = accessToken?.split(".")[1]
  if (!segment) return null
  try {
    // Decode the base64url payload with Web APIs (atob/TextDecoder) so it works in both
    // the Node and Edge runtimes — Buffer isn't available on Edge.
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)))
    const claims = JSON.parse(json) as { app_metadata?: { permissions?: unknown } }
    const perms = claims.app_metadata?.permissions
    return Array.isArray(perms) ? (perms as AppPermission[]) : null
  } catch {
    return null
  }
}

// Returns the signed-in user's firm-scoped profile, or null when not
// authenticated (or while Supabase isn't configured yet).
async function loadCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  const user = data.user

  // Only active staff are authenticated. A disabled (or not-yet-activated)
  // profile resolves to no row → null → the app shell redirects to /login,
  // even though Supabase Auth may still accept the credentials.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, email, name, role, firm_id, pod_id")
    .eq("id", user.id)
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

  // Permissions are stamped into the JWT by the access-token hook — they live in the
  // token's claims, NOT in the database app_metadata that getUser() returns. Read them
  // from the access token (getUser() above already validated it). Absent (null) until
  // the hook is live, which signals callers to fall back to the role-based matrix.
  const { data: sessionData } = await supabase.auth.getSession()
  const permissions = permissionsFromAccessToken(sessionData.session?.access_token)

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
// server component that needs the user share ONE auth round-trip + profile query — instead of
// repeating `auth.getUser()` (a network call) and the profile read at every call site in a render.
export const getCurrentUser = cache(loadCurrentUser)
