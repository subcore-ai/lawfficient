import { describe, expect, test } from "bun:test"

import { generateKey, hashKey } from "./keys"

describe("hashKey", () => {
  test("is deterministic sha256 hex (64 chars)", () => {
    const h = hashKey("lfk_example")
    expect(h).toBe(hashKey("lfk_example"))
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  test("differs for different keys", () => {
    expect(hashKey("a")).not.toBe(hashKey("b"))
  })
})

describe("generateKey", () => {
  test("returns a prefixed raw key with a matching hash + last4", () => {
    const k = generateKey()
    expect(k.raw.startsWith("lfk_")).toBe(true)
    expect(k.hash).toBe(hashKey(k.raw))
    expect(k.last4).toBe(k.raw.slice(-4))
    expect(k.last4.length).toBe(4)
  })

  test("is unique per call", () => {
    expect(generateKey().raw).not.toBe(generateKey().raw)
  })
})
