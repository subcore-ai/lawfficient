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
    const c: Cursor = { createdAt: "2026-06-23T10:00:00.000Z", id: "abc-123" }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })

  test("is opaque (base64url, no raw separator leaked)", () => {
    const token = encodeCursor({ createdAt: "2026-06-23T10:00:00.000Z", id: "abc-123" })
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
    const rows = [
      { id: "1", created_at: "2026-06-23T10:00:00.000Z" },
      { id: "2", created_at: "2026-06-23T09:00:00.000Z" },
      { id: "3", created_at: "2026-06-23T08:00:00.000Z" }, // the +1 sentinel
    ]
    const page = buildPage(rows, 2, toCursor)
    expect(page.data.map((r) => r.id)).toEqual(["1", "2"])
    expect(page.next_cursor).not.toBeNull()
    expect(decodeCursor(page.next_cursor)).toEqual({ createdAt: "2026-06-23T09:00:00.000Z", id: "2" })
  })

  test("empty result → empty page, null cursor", () => {
    expect(buildPage([], 50, toCursor)).toEqual({ data: [], next_cursor: null })
  })
})
