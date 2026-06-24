import { describe, expect, test } from "bun:test"

import {
  buildPage,
  decodeCursor,
  DEFAULT_LIMIT,
  encodeCursor,
  MAX_LIMIT,
  parseLimit,
  type Cursor,
} from "./pagination"

describe("parseLimit", () => {
  test("defaults when missing / blank / non-numeric / non-positive", () => {
    expect(parseLimit(null)).toBe(DEFAULT_LIMIT)
    expect(parseLimit("")).toBe(DEFAULT_LIMIT)
    expect(parseLimit("abc")).toBe(DEFAULT_LIMIT)
    expect(parseLimit("0")).toBe(DEFAULT_LIMIT)
    expect(parseLimit("-5")).toBe(DEFAULT_LIMIT)
  })

  test("clamps to MAX_LIMIT and floors fractions", () => {
    expect(parseLimit("10")).toBe(10)
    expect(parseLimit("250")).toBe(MAX_LIMIT)
    expect(parseLimit("25.9")).toBe(25)
  })
})

describe("cursor encode/decode round-trips", () => {
  test("round-trips createdAt + id", () => {
    const c: Cursor = { createdAt: "2026-06-23T10:00:00.000Z", id: "3f8c1e2a-1b2c-4d5e-8f90-abcdef012345" }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })

  test("is opaque (base64url, no raw separator leaked)", () => {
    const token = encodeCursor({ createdAt: "2026-06-23T10:00:00.000Z", id: "3f8c1e2a-1b2c-4d5e-8f90-abcdef012345" })
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token).not.toContain("|")
  })

  test("returns null for null / malformed (no separator) input", () => {
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor(Buffer.from("no-separator", "utf8").toString("base64url"))).toBeNull()
  })

  test("returns null when either half is empty", () => {
    expect(decodeCursor(Buffer.from("|abc", "utf8").toString("base64url"))).toBeNull()
    expect(decodeCursor(Buffer.from("2026|", "utf8").toString("base64url"))).toBeNull()
  })

  test("rejects a cursor whose id is not a UUID or createdAt is not ISO-8601", () => {
    // both halves interpolate into the raw keyset `.or(...)`, so each is validated on decode
    expect(decodeCursor(encodeCursor({ createdAt: "2026-06-23T10:00:00.000Z", id: "2" }))).toBeNull()
    expect(
      decodeCursor(encodeCursor({ createdAt: "not-a-date", id: "3f8c1e2a-1b2c-4d5e-8f90-abcdef012345" })),
    ).toBeNull()
    const injected = Buffer.from(
      "2026-06-23T10:00:00Z,phone.ilike.*|3f8c1e2a-1b2c-4d5e-8f90-abcdef012345",
      "utf8",
    ).toString("base64url")
    expect(decodeCursor(injected)).toBeNull()
  })
})

describe("buildPage", () => {
  const toCursor = (r: { created_at: string; id: string }): Cursor => ({ createdAt: r.created_at, id: r.id })

  test("no extra row → last page, next_cursor null", () => {
    const rows = [
      { id: "1", created_at: "2026-06-23T10:00:00.000Z" },
      { id: "2", created_at: "2026-06-23T09:00:00.000Z" },
    ]
    const page = buildPage(rows, 5, toCursor)
    expect(page.data).toHaveLength(2)
    expect(page.next_cursor).toBeNull()
  })

  test("limit+1 rows → drops the extra and emits a cursor from the last KEPT row", () => {
    const u1 = "11111111-1111-4111-8111-111111111111"
    const u2 = "22222222-2222-4222-8222-222222222222"
    const u3 = "33333333-3333-4333-8333-333333333333"
    const rows = [
      { id: u1, created_at: "2026-06-23T10:00:00.000Z" },
      { id: u2, created_at: "2026-06-23T09:00:00.000Z" },
      { id: u3, created_at: "2026-06-23T08:00:00.000Z" }, // the +1 sentinel
    ]
    const page = buildPage(rows, 2, toCursor)
    expect(page.data.map((r) => r.id)).toEqual([u1, u2])
    expect(page.next_cursor).not.toBeNull()
    expect(decodeCursor(page.next_cursor)).toEqual({ createdAt: "2026-06-23T09:00:00.000Z", id: u2 })
  })

  test("empty result → empty page, null cursor", () => {
    expect(buildPage([], 50, toCursor)).toEqual({ data: [], next_cursor: null })
  })
})
