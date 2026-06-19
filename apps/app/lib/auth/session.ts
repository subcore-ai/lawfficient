// Server-side session helpers. Feature code should resolve the current user
// through these so role + firm scoping stay consistent everywhere.
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import type { Role } from "@/data/types"

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: Role
  firmId: string
  podId: string | null
}

// Returns the signed-in user's firm-scoped profile, or null when not
// authenticated (or while Supabase isn't configured yet).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("profiles")
    .select("id, email, name, role, firm_id, pod_id")
    .eq("id", user.id)
    .single()

  // Cast: column-level types arrive once database.types.ts is regenerated.
  const profile = data as {
    id: string
    email: string
    name: string
    role: string
    firm_id: string
    pod_id: string | null
  } | null
  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as Role,
    firmId: profile.firm_id,
    podId: profile.pod_id,
  }
}
