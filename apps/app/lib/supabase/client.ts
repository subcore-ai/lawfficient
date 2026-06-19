// Browser Supabase client for use in Client Components.
import { createBrowserClient } from "@supabase/ssr"

import { requireSupabaseEnv } from "./env"
import type { Database } from "./database.types"

export function createClient() {
  const { url, anonKey } = requireSupabaseEnv()
  return createBrowserClient<Database>(url, anonKey)
}
