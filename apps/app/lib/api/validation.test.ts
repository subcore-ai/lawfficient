import { describe, expect, test } from "bun:test"

import { isIsoTimestamp, isUuid } from "./validation"

describe("isUuid", () => {
  test("accepts a canonical UUID (either case)", () => {
    expect(isUuid("3f8c1e2a-1b2c-4d5e-8f90-abcdef012345")).toBe(true)
    expect(isUuid("3F8C1E2A-1B2C-4D5E-8F90-ABCDEF012345")).toBe(true)
  })

  test("rejects non-UUIDs and filter-injection payloads", () => {
    expect(isUuid("")).toBe(false)
    expect(isUuid("abc-123")).toBe(false)
    expect(isUuid("2")).toBe(false)
    // would otherwise break out of `.eq("id", …)` / the keyset `.or(...)`
    expect(isUuid("3f8c1e2a-1b2c-4d5e-8f90-abcdef012345,phone.ilike.*")).toBe(false)
    expect(isUuid("0),or(firm_id.eq.other")).toBe(false)
  })
})

describe("isIsoTimestamp", () => {
  test("accepts the shapes Postgres timestamptz serializes to", () => {
    expect(isIsoTimestamp("2026-06-23T10:00:00.000Z")).toBe(true)
    expect(isIsoTimestamp("2026-06-23T10:00:00Z")).toBe(true)
    expect(isIsoTimestamp("2026-06-23T10:00:00.123456+00:00")).toBe(true)
    expect(isIsoTimestamp("2026-06-23T10:00:00+00")).toBe(true)
    expect(isIsoTimestamp("2026-06-23T10:00:00-05:00")).toBe(true)
  })

  test("rejects malformed values and filter-injection payloads", () => {
    expect(isIsoTimestamp("")).toBe(false)
    expect(isIsoTimestamp("2026-06-23")).toBe(false)
    expect(isIsoTimestamp("not-a-date")).toBe(false)
    expect(isIsoTimestamp("2026-06-23T10:00:00Z,phone.ilike.*")).toBe(false)
    expect(isIsoTimestamp("2026-06-23T10:00:00Z)")).toBe(false)
  })
})
