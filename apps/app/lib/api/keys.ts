// Resolve a public-API key (by its sha256 hash) to its firm + scopes. Models
// resolveSourceByKey (lib/ingest/store): the firm is read from this row — NEVER the request
// body. Only ENABLED keys resolve, so a disabled key reads as "no such key" here; the auth
// layer maps that to 403 separately by re-checking. A lookup error throws (→ 503 at the route)
// so a transient blip never masquerades as a bad key. Uses the service-role admin client (no
// user session → RLS does not apply), so the lookup is scoped to the single hashed key.
import type { createAdminClient } from "@/lib/supabase/admin"

type Admin = ReturnType<typeof createAdminClient>

export type ResolvedApiKey = { firmId: string; scopes: string[]; keyId: string; enabled: boolean }

export async function resolveApiKey(admin: Admin, keyHash: string): Promise<ResolvedApiKey | null> {
  const { data, error } = await admin
    .from("api_keys")
    .select("id, firm_id, scopes, enabled")
    .eq("key_hash", keyHash)
    .maybeSingle()
  if (error) throw new Error("api_key_lookup_failed")
  if (!data) return null
  return { firmId: data.firm_id, scopes: data.scopes, keyId: data.id, enabled: data.enabled }
}

// Best-effort touch of last_used_at (observability for the future management UI). A failure here
// must never fail the request, so it's swallowed.
export async function touchApiKey(admin: Admin, keyId: string): Promise<void> {
  try {
    await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyId)
  } catch {
    // swallow
  }
}
