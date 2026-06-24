import { describe, expect, test } from "bun:test"

import { findIdempotentResponse, storeIdempotentResponse, MAX_IDEMPOTENCY_KEY_LENGTH } from "./idempotency"
import type { createAdminClient } from "@/lib/supabase/admin"

type Admin = ReturnType<typeof createAdminClient>

// A chainable stub of the admin client's PostgREST surface, just enough for these helpers:
//   - .from(t).insert(row)                            → resolves { error }
//   - .from(t).select(c).eq().eq().eq().maybeSingle() → resolves { data, error }
// Records the inserted rows so a test can assert what would persist.
function fakeAdmin(opts: {
  insertError?: { code?: string; message?: string } | null
  existing?: { response_status: number; response_body: unknown } | null
  selectError?: boolean
}) {
  const inserts: unknown[] = []
  const admin = {
    from() {
      const builder = {
        insert(row: unknown) {
          inserts.push(row)
          return Promise.resolve({ error: opts.insertError ?? null })
        },
        select() {
          return builder
        },
        eq() {
          return builder
        },
        maybeSingle() {
          if (opts.selectError) return Promise.resolve({ data: null, error: { message: "boom" } })
          return Promise.resolve({ data: opts.existing ?? null, error: null })
        },
      }
      return builder
    },
    _inserts: inserts,
  }
  return admin as unknown as Admin & { _inserts: unknown[] }
}

const KEY = { firmId: "firm-1", apiKeyId: "key-1", idempotencyKey: "idem-abc" }

describe("findIdempotentResponse", () => {
  test("returns the stored {status, body} on a hit", async () => {
    const admin = fakeAdmin({ existing: { response_status: 201, response_body: { id: "lead-1" } } })
    const r = await findIdempotentResponse(admin, KEY.firmId, KEY.apiKeyId, KEY.idempotencyKey)
    expect(r).toEqual({ status: 201, body: { id: "lead-1" } })
  })

  test("returns null on a miss", async () => {
    const admin = fakeAdmin({ existing: null })
    expect(await findIdempotentResponse(admin, KEY.firmId, KEY.apiKeyId, KEY.idempotencyKey)).toBeNull()
  })

  test("throws on a real lookup error (route maps to 503)", async () => {
    const admin = fakeAdmin({ selectError: true })
    await expect(findIdempotentResponse(admin, KEY.firmId, KEY.apiKeyId, KEY.idempotencyKey)).rejects.toThrow(
      "idempotency_lookup_failed",
    )
  })
})

describe("storeIdempotentResponse", () => {
  const body = { id: "lead-1" }

  test("clean insert → returns the original response + persists a row", async () => {
    const admin = fakeAdmin({ insertError: null })
    const r = await storeIdempotentResponse(admin, { ...KEY, leadId: "lead-1", status: 201, body })
    expect(r).toEqual({ status: 201, body })
    expect(admin._inserts).toHaveLength(1)
  })

  test("unique-violation race → replays the WINNER's stored response", async () => {
    const admin = fakeAdmin({
      insertError: { code: "23505", message: "duplicate key" },
      existing: { response_status: 201, response_body: { id: "winner-lead" } },
    })
    const r = await storeIdempotentResponse(admin, { ...KEY, leadId: "lead-1", status: 201, body })
    expect(r).toEqual({ status: 201, body: { id: "winner-lead" } })
  })

  test("a non-conflict insert error is swallowed → returns the original (never throws)", async () => {
    const admin = fakeAdmin({ insertError: { code: "55000", message: "transient" } })
    const r = await storeIdempotentResponse(admin, { ...KEY, leadId: "lead-1", status: 201, body })
    expect(r).toEqual({ status: 201, body })
  })
})

describe("MAX_IDEMPOTENCY_KEY_LENGTH", () => {
  test("is a sane bound for opaque tokens", () => {
    expect(MAX_IDEMPOTENCY_KEY_LENGTH).toBe(255)
  })
})
