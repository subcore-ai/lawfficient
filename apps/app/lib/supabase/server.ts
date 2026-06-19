// Server Supabase client for Server Components, Server Actions, and Route Handlers.
// cookies() is async in Next.js 16 — always await this factory.
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { requireSupabaseEnv } from "./env"
import type { Database } from "./database.types"

export async function createClient() {
  const { url, anonKey } = requireSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component where cookies are read-only.
          // The middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}
