// Supabase environment access.
// During Phase 0 the project may not be wired yet, so we expose a guard that
// lets the mock app keep building/running until real credentials are supplied.
//
// Uses the publishable key (sb_publishable_…), Supabase's current frontend key
// that replaces the legacy anon JWT.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)
}

export function requireSupabaseEnv(): { url: string; publishableKey: string } {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see apps/app/.env.example).",
    )
  }
  return { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY }
}
