import { describe, expect, test } from "bun:test"

import { parseIdempotencyKey, MAX_IDEMPOTENCY_KEY_LENGTH } from "./idempotency"

// The dedup itself is enforced atomically in the DB (api_create_lead, migration 0036) and exercised
// there; the only logic left in TS is parsing + bounding the optional header.
describe("parseIdempotencyKey", () => {
  test("no header → ok with key null (a normal, non-idempotent create)", () => {
    expect(parseIdempotencyKey(null)).toEqual({ ok: true, key: null })
    expect(parseIdempotencyKey(undefined)).toEqual({ ok: true, key: null })
  })

  test("empty / whitespace-only → treated as absent", () => {
    expect(parseIdempotencyKey("")).toEqual({ ok: true, key: null })
    expect(parseIdempotencyKey("   ")).toEqual({ ok: true, key: null })
  })

  test("trims surrounding whitespace", () => {
    expect(parseIdempotencyKey("  abc-123  ")).toEqual({ ok: true, key: "abc-123" })
  })

  test("a normal opaque token passes through", () => {
    expect(parseIdempotencyKey("01J0X9F4Z8KQ")).toEqual({ ok: true, key: "01J0X9F4Z8KQ" })
  })

  test("at the max length → still ok", () => {
    const key = "k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH)
    expect(parseIdempotencyKey(key)).toEqual({ ok: true, key })
  })

  test("over the max length → invalid (route returns 400)", () => {
    expect(parseIdempotencyKey("k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1))).toEqual({ ok: false })
  })

  test("length is measured AFTER trimming (trailing spaces don't count)", () => {
    const key = "k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH)
    expect(parseIdempotencyKey(`  ${key}  `)).toEqual({ ok: true, key })
  })
})

describe("MAX_IDEMPOTENCY_KEY_LENGTH", () => {
  test("is a sane bound for opaque tokens", () => {
    expect(MAX_IDEMPOTENCY_KEY_LENGTH).toBe(255)
  })
})
