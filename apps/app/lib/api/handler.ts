// Shared scaffolding for public-API route handlers (spec 26) so each route file holds only its
// own parse + query + serialize. Order mirrors the ingestion route: config guard (503 on
// misconfig) → resolve + echo version → Bearer auth for the required scope → per-key rate limit
// → run the handler → uniform 500 on an unexpected throw. Every response carries the version
// header; every error uses the envelope.
import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { authenticate, type AuthContext } from "./auth"
import { apiError } from "./errors"
import { rateLimitByKey } from "./rate-limit"
import { resolveVersion, withVersion } from "./version"

type Admin = ReturnType<typeof createAdminClient>

type HandlerFn = (args: {
  request: NextRequest
  admin: Admin
  context: AuthContext
  version: string
}) => Promise<NextResponse>

// Wrap a handler with auth + version + rate-limit + error handling for the given scope.
export async function withApi(
  request: NextRequest,
  scope: string,
  handler: HandlerFn,
): Promise<NextResponse> {
  const version = resolveVersion(request.headers)
  const echo = (res: NextResponse) => withVersion(res, version)

  // Needs the publishable env AND the server-only secret (the admin client throws without it);
  // surface a misconfig as a clear 503, not an uncaught 500 deeper in.
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
    return echo(apiError("unavailable", "The API is not configured.", 503))
  }

  const admin = createAdminClient()

  const auth = await authenticate(request, admin, scope)
  if (!auth.ok) {
    return echo(apiError(auth.failure.code, auth.failure.message, auth.failure.status))
  }

  const limit = rateLimitByKey(auth.context.keyId)
  if (!limit.ok) {
    const res = apiError("rate_limited", "Rate limit exceeded.", 429)
    res.headers.set("Retry-After", String(limit.retryAfterSeconds))
    return echo(res)
  }

  try {
    return echo(await handler({ request, admin, context: auth.context, version }))
  } catch {
    return echo(apiError("internal_error", "An unexpected error occurred.", 500))
  }
}
