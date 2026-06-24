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
    expect(isIsoTimestamp("2026-06-23T10:00:00-05:00")).toBe(true)
    expect(isIsoTimestamp("2026-06-23T10:00:00+14:00")).toBe(true) // max real offset
    expect(isIsoTimestamp("2026-06-23T05:30:00+05:30")).toBe(true)
    expect(isIsoTimestamp("2024-02-29T00:00:00Z")).toBe(true) // real leap day
  })

  test("rejects malformed, out-of-range, and filter-injection payloads", () => {
    expect(isIsoTimestamp("")).toBe(false)
    expect(isIsoTimestamp("2026-06-23")).toBe(false)
    expect(isIsoTimestamp("not-a-date")).toBe(false)
    expect(isIsoTimestamp("2026-06-23T10:00:00+00")).toBe(false) // bare 2-digit offset (not emitted)
    expect(isIsoTimestamp("2026-06-23T10:00:00Z,phone.ilike.*")).toBe(false)
    expect(isIsoTimestamp("2026-06-23T10:00:00Z)")).toBe(false)
    // matches the regex shape but is not a real instant → rejected (Postgres would 500 on the cast)
    expect(isIsoTimestamp("2026-13-45T99:99:99Z")).toBe(false)
    expect(isIsoTimestamp("2026-02-30T10:00:00Z")).toBe(false)
    expect(isIsoTimestamp("2026-06-31T10:00:00Z")).toBe(false)
    expect(isIsoTimestamp("2025-02-29T00:00:00Z")).toBe(false) // 2025 is not a leap year
    expect(isIsoTimestamp("2026-06-23T10:00:00+25:00")).toBe(false) // offset hour out of range
    expect(isIsoTimestamp("2026-06-23T10:00:00+14:30")).toBe(false) // beyond ±14:00
    expect(isIsoTimestamp("2026-06-23T10:00:00+12:99")).toBe(false) // offset minute out of range
  })
})
