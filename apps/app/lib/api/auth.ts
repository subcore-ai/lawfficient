// Bearer-key auth for the public API (spec 26). Mirrors the ingestion route's key flow: parse
// `Authorization: Bearer <key>`, hash it, resolve the firm + scopes server-side (NEVER the body),
// then require the endpoint's scope. Status mapping, matching ingestion's cases:
//   - missing / unparseable / unknown key  → 401
//   - disabled key OR missing scope        → 403
//   - transient lookup failure             → 503 (don't masquerade as a bad key)
// Uses the service-role admin client (no user session → RLS does not apply); the caller MUST
// scope every subsequent query by the returned firmId.
import type { NextRequest } from "next/server"

import { hashKey } from "@/lib/ingest/keys"
import type { createAdminClient } from "@/lib/supabase/admin"
import { resolveApiKey, touchApiKey, type ResolvedApiKey } from "./keys"

type Admin = ReturnType<typeof createAdminClient>

export type AuthContext = { firmId: string; scopes: string[]; keyId: string }

export type AuthFailure = {
  status: 401 | 403 | 503
  code: "missing_key" | "invalid_key" | "key_disabled" | "insufficient_scope" | "unavailable"
  message: string
}

export type AuthResult = { ok: true; context: AuthContext } | { ok: false; failure: AuthFailure }

export function bearerKey(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

// Pure decision: given a resolved key (or null) and the required scope, what's the outcome?
// Separated from I/O so every branch is unit-tested without a DB. Note resolveApiKey only
// returns ENABLED keys, but we still branch on `enabled` defensively to keep the 403 path
// explicit and total.
export function decideAuth(resolved: ResolvedApiKey | null, requiredScope: string): AuthResult {
  if (!resolved) {
    return { ok: false, failure: { status: 401, code: "invalid_key", message: "Invalid API key." } }
  }
  if (!resolved.enabled) {
    return { ok: false, failure: { status: 403, code: "key_disabled", message: "This API key is disabled." } }
  }
  if (!resolved.scopes.includes(requiredScope)) {
    return {
      ok: false,
      failure: {
        status: 403,
        code: "insufficient_scope",
        message: `This API key is missing the required scope: ${requiredScope}.`,
      },
    }
  }
  return { ok: true, context: { firmId: resolved.firmId, scopes: resolved.scopes, keyId: resolved.keyId } }
}

// Full auth: parse → resolve → decide. Throws nothing; a lookup blip becomes a 503 failure.
export async function authenticate(
  request: NextRequest,
  admin: Admin,
  requiredScope: string,
): Promise<AuthResult> {
  const rawKey = bearerKey(request)
  if (!rawKey) {
    return { ok: false, failure: { status: 401, code: "missing_key", message: "Missing API key." } }
  }

  let resolved: ResolvedApiKey | null
  try {
    resolved = await resolveApiKey(admin, hashKey(rawKey))
  } catch {
    return { ok: false, failure: { status: 503, code: "unavailable", message: "Temporarily unavailable." } }
  }

  const result = decideAuth(resolved, requiredScope)
  // Best-effort observability touch only once the key is fully authorized.
  if (result.ok) void touchApiKey(admin, result.context.keyId)
  return result
}
