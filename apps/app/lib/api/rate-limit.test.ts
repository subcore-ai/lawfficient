import { describe, expect, test } from "bun:test"

import { checkRateLimit, sweepExpired, type RateLimitStore } from "./rate-limit"

describe("checkRateLimit", () => {
  test("allows up to the limit, then 429s with a Retry-After", () => {
    const store: RateLimitStore = new Map()
    const now = 1_000_000
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(store, "k", now, 3, 60).ok).toBe(true)
    }
    const blocked = checkRateLimit(store, "k", now, 3, 60)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBe(60)
  })

  test("evicts hits outside the window so the count resets over time", () => {
    const store: RateLimitStore = new Map()
    expect(checkRateLimit(store, "k", 0, 2, 60).ok).toBe(true)
    expect(checkRateLimit(store, "k", 0, 2, 60).ok).toBe(true)
    expect(checkRateLimit(store, "k", 0, 2, 60).ok).toBe(false)
    // 61s later the early hits have aged out of the 60s window.
    expect(checkRateLimit(store, "k", 61_000, 2, 60).ok).toBe(true)
  })

  test("Retry-After shrinks as the oldest in-window hit approaches expiry", () => {
    const store: RateLimitStore = new Map()
    checkRateLimit(store, "k", 0, 1, 60)
    const blocked = checkRateLimit(store, "k", 30_000, 1, 60)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBe(30)
  })

  test("buckets are independent per key", () => {
    const store: RateLimitStore = new Map()
    expect(checkRateLimit(store, "a", 0, 1, 60).ok).toBe(true)
    expect(checkRateLimit(store, "a", 0, 1, 60).ok).toBe(false)
    expect(checkRateLimit(store, "b", 0, 1, 60).ok).toBe(true)
  })
})

describe("sweepExpired", () => {
  test("drops buckets whose newest hit has aged out, keeps live ones", () => {
    const store: RateLimitStore = new Map()
    checkRateLimit(store, "old", 0, 5, 60) // last hit at t=0
    checkRateLimit(store, "live", 50_000, 5, 60) // last hit at t=50s
    sweepExpired(store, 61_000, 60) // window now spans (1s, 61s]
    expect(store.has("old")).toBe(false)
    expect(store.has("live")).toBe(true)
  })
})
