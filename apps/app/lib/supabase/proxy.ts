// Session-refresh proxy helper.
// Keeps the Supabase auth cookie fresh on every request and gates the
// authenticated app shell. No-ops when Supabase isn't configured yet so the
// Phase 0 mock app keeps working until credentials + a first user exist.
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env"

// Unauthenticated (no-session) requests are allowed on these path prefixes. The /api routes do
// their own Bearer-key auth in the route handler (not via session): /api/leads is the ingestion
// webhook + the public leads read API; /api/openapi.json is the public, read-only API contract.
const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/auth", "/api/leads", "/api/openapi.json"]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    // Carry over any refreshed/cleared auth cookies so the redirect doesn't drop
    // them — otherwise stale cookies can cause a redirect loop.
    const redirectResponse = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie)
    }
    return redirectResponse
  }

  return response
}
