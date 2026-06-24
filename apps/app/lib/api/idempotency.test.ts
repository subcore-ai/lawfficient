import { describe, expect, test } from "bun:test"

import {
  reserveIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
  MAX_IDEMPOTENCY_KEY_LENGTH,
} from "./idempotency"
import type { createAdminClient } from "@/lib/supabase/admin"

type Admin = ReturnType<typeof createAdminClient>

// Chainable stub of the admin PostgREST surface the idempotency helpers use:
//   insert(row)                          → { error }  (1st call vs retry can differ)
//   select().eq()×3.maybeSingle()        → { data, error }
//   update(row).eq()×3                   → { error }
//   delete().eq()×3.is()                 → { error }
function fakeAdmin(opts: {
  insertError?: { code?: string; message?: string } | null
  retryInsertError?: { code?: string; message?: string } | null
  existing?: { response_status: number | null; response_body: unknown; created_at?: string } | null
  selectError?: boolean
}) {
  const ops: { kind: string; arg?: unknown }[] = []
  let insertCalls = 0
  const admin = {
    from() {
      const builder: Record<string, (...a: unknown[]) => unknown> = {}
      builder.insert = (row: unknown) => {
        ops.push({ kind: "insert", arg: row })
        insertCalls += 1
        const err = insertCalls === 1 ? (opts.insertError ?? null) : (opts.retryInsertError ?? null)
        return Promise.resolve({ error: err })
      }
      builder.update = (row: unknown) => {
        ops.push({ kind: "update", arg: row })
        return { eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }
      }
      builder.delete = () => {
        ops.push({ kind: "delete" })
        return { eq: () => ({ eq: () => ({ eq: () => ({ is: () => Promise.resolve({ error: null }) }) }) }) }
      }
      builder.select = () => builder
      builder.eq = () => builder
      builder.maybeSingle = () => {
        if (opts.selectError) return Promise.resolve({ data: null, error: { message: "boom" } })
        return Promise.resolve({ data: opts.existing ?? null, error: null })
      }
      return builder
    },
    _ops: ops,
  }
  return admin as unknown as Admin & { _ops: { kind: string; arg?: unknown }[] }
}

const K = { firmId: "firm-1", apiKeyId: "key-1", idempotencyKey: "idem-abc" }
const recentIso = () => new Date(Date.now() - 1_000).toISOString()
const staleIso = () => new Date(Date.now() - 10 * 60_000).toISOString()

describe("reserveIdempotencyKey", () => {
  test("clean insert → reserved (we own the key)", async () => {
    const admin = fakeAdmin({ insertError: null })
    expect(await reserveIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)).toEqual({ kind: "reserved" })
    expect(admin._ops[0]?.kind).toBe("insert")
  })

  test("23505 + a completed holder → replay the holder's response", async () => {
    const admin = fakeAdmin({
      insertError: { code: "23505" },
      existing: { response_status: 201, response_body: { id: "winner" }, created_at: recentIso() },
    })
    expect(await reserveIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)).toEqual({
      kind: "replay",
      status: 201,
      body: { id: "winner" },
    })
  })

  test("23505 + a RECENT pending holder → pending", async () => {
    const admin = fakeAdmin({
      insertError: { code: "23505" },
      existing: { response_status: null, response_body: null, created_at: recentIso() },
    })
    expect(await reserveIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)).toEqual({ kind: "pending" })
    expect(admin._ops.some((o) => o.kind === "delete")).toBe(false) // not reclaimed — still in flight
  })

  test("23505 + a STALE pending holder → reclaim and reserve", async () => {
    const admin = fakeAdmin({
      insertError: { code: "23505" },
      retryInsertError: null, // we win the reclaim's re-insert
      existing: { response_status: null, response_body: null, created_at: staleIso() },
    })
    expect(await reserveIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)).toEqual({ kind: "reserved" })
    expect(admin._ops.some((o) => o.kind === "delete")).toBe(true) // reclaimed the dead reservation
  })

  test("23505 + STALE but another reclaimer wins the re-insert → pending", async () => {
    const admin = fakeAdmin({
      insertError: { code: "23505" },
      retryInsertError: { code: "23505" },
      existing: { response_status: null, response_body: null, created_at: staleIso() },
    })
    expect(await reserveIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)).toEqual({ kind: "pending" })
  })

  test("23505 but the holder row vanished (released mid-race) → pending", async () => {
    const admin = fakeAdmin({ insertError: { code: "23505" }, existing: null })
    expect(await reserveIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)).toEqual({ kind: "pending" })
  })

  test("a non-conflict insert error → throws (route maps to 503)", async () => {
    const admin = fakeAdmin({ insertError: { code: "55000" } })
    await expect(reserveIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)).rejects.toThrow(
      "idempotency_reserve_failed",
    )
  })

  test("a conflict then a lookup error → throws (route maps to 503)", async () => {
    const admin = fakeAdmin({ insertError: { code: "23505" }, selectError: true })
    await expect(reserveIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)).rejects.toThrow(
      "idempotency_lookup_failed",
    )
  })

  test("throws on a missing firmId (fail-open backstop)", async () => {
    const admin = fakeAdmin({ insertError: null })
    await expect(reserveIdempotencyKey(admin, "", K.apiKeyId, K.idempotencyKey)).rejects.toThrow()
  })
})

describe("completeIdempotencyKey / releaseIdempotencyKey", () => {
  test("complete fills in the row, never throws", async () => {
    const admin = fakeAdmin({ insertError: null })
    await completeIdempotencyKey(admin, { ...K, leadId: "lead-1", status: 201, body: { id: "lead-1" } })
    expect(admin._ops.some((o) => o.kind === "update")).toBe(true)
  })

  test("release deletes the pending reservation, never throws", async () => {
    const admin = fakeAdmin({ insertError: null })
    await releaseIdempotencyKey(admin, K.firmId, K.apiKeyId, K.idempotencyKey)
    expect(admin._ops.some((o) => o.kind === "delete")).toBe(true)
  })
})

describe("MAX_IDEMPOTENCY_KEY_LENGTH", () => {
  test("is a sane bound for opaque tokens", () => {
    expect(MAX_IDEMPOTENCY_KEY_LENGTH).toBe(255)
  })
})
