import { describe, expect, test } from "bun:test"
import type { NextRequest } from "next/server"

import { bearerKey, decideAuth } from "./auth"
import type { ResolvedApiKey } from "./keys"

function reqWith(authorization?: string): NextRequest {
  return { headers: new Headers(authorization ? { authorization } : {}) } as NextRequest
}

describe("bearerKey", () => {
  test("extracts the token, case-insensitively, trimmed", () => {
    expect(bearerKey(reqWith("Bearer lak_abc"))).toBe("lak_abc")
    expect(bearerKey(reqWith("bearer  lak_xyz  "))).toBe("lak_xyz")
  })

  test("returns null when missing or malformed", () => {
    expect(bearerKey(reqWith())).toBeNull()
    expect(bearerKey(reqWith("lak_no_scheme"))).toBeNull()
    expect(bearerKey(reqWith("Basic abc"))).toBeNull()
  })
})

describe("decideAuth", () => {
  const key = (over: Partial<ResolvedApiKey> = {}): ResolvedApiKey => ({
    firmId: "firm-1",
    scopes: ["leads:read"],
    keyId: "key-1",
    enabled: true,
    ...over,
  })

  test("unknown key → 401 invalid_key", () => {
    const r = decideAuth(null, "leads:read")
    expect(r.ok).toBe(false)
    if (!r.ok) expect([r.failure.status, r.failure.code]).toEqual([401, "invalid_key"])
  })

  test("disabled key → 403 key_disabled", () => {
    const r = decideAuth(key({ enabled: false }), "leads:read")
    expect(r.ok).toBe(false)
    if (!r.ok) expect([r.failure.status, r.failure.code]).toEqual([403, "key_disabled"])
  })

  test("missing scope → 403 insufficient_scope", () => {
    const r = decideAuth(key({ scopes: ["leads:write"] }), "leads:read")
    expect(r.ok).toBe(false)
    if (!r.ok) expect([r.failure.status, r.failure.code]).toEqual([403, "insufficient_scope"])
  })

  test("enabled key with the scope → ok, returns firm context", () => {
    const r = decideAuth(key(), "leads:read")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.context).toEqual({ firmId: "firm-1", scopes: ["leads:read"], keyId: "key-1" })
  })
})
