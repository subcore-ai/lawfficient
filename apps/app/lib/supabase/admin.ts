// Service-role Supabase client for privileged auth-system operations (auth.admin.*):
// inviting users, regenerating invite links, deleting a revoked invite, syncing
// app_metadata, and revoking sessions. It bypasses RLS, so every caller MUST enforce
// authorization itself (acting user is an admin; the target is in the same firm).
//
// SERVER-ONLY. SUPABASE_SECRET_KEY (sb_secret_…) has no NEXT_PUBLIC_ prefix, so Next
// never inlines it into the client bundle — only import this from Server Actions and
// Route Handlers, never a Client Component.
import { createClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"
import { SUPABASE_URL } from "./env"

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!SUPABASE_URL || !secretKey) {
    throw new Error(
      "Admin Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (server-only).",
    )
  }

  return createClient<Database>(SUPABASE_URL, secretKey, {
    // Not tied to a user/session — no cookie storage, no token refresh.
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
