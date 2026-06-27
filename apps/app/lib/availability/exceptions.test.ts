import { describe, expect, test } from "bun:test"

import { isDateOff, isValidYmd, parseTimeOffInput } from "./exceptions"

describe("isValidYmd", () => {
  test("accepts real dates, rejects malformed / impossible ones", () => {
    expect(isValidYmd("2026-07-01")).toBe(true)
    expect(isValidYmd("2026-02-29")).toBe(false) // not a leap year
    expect(isValidYmd("2026-13-40")).toBe(false)
    expect(isValidYmd("2026-7-1")).toBe(false)
    expect(isValidYmd("nope")).toBe(false)
  })
})

describe("isDateOff", () => {
  const ranges = [
    { startDate: "2026-07-01", endDate: "2026-07-05" },
    { startDate: "2026-12-25", endDate: "2026-12-25" }, // single day
  ]
  test("true inside a range, inclusive of both ends", () => {
    expect(isDateOff(ranges, "2026-07-01")).toBe(true)
    expect(isDateOff(ranges, "2026-07-03")).toBe(true)
    expect(isDateOff(ranges, "2026-07-05")).toBe(true)
    expect(isDateOff(ranges, "2026-12-25")).toBe(true)
  })
  test("false outside every range", () => {
    expect(isDateOff(ranges, "2026-06-30")).toBe(false)
    expect(isDateOff(ranges, "2026-07-06")).toBe(false)
    expect(isDateOff([], "2026-07-03")).toBe(false)
  })
})

describe("parseTimeOffInput", () => {
  test("accepts a valid range + trims an optional note", () => {
    const r = parseTimeOffInput({ startDate: "2026-07-01", endDate: "2026-07-05", note: "  Vacation  " })
    expect(r).toEqual({ ok: true, value: { startDate: "2026-07-01", endDate: "2026-07-05", note: "Vacation" } })
  })
  test("a single-day range is allowed and an empty note becomes null", () => {
    const r = parseTimeOffInput({ startDate: "2026-12-25", endDate: "2026-12-25", note: "  " })
    expect(r).toEqual({ ok: true, value: { startDate: "2026-12-25", endDate: "2026-12-25", note: null } })
  })
  test("rejects invalid dates and end-before-start", () => {
    expect(parseTimeOffInput({ startDate: "2026-13-01", endDate: "2026-07-05", note: null }).ok).toBe(false)
    expect(parseTimeOffInput({ startDate: "2026-07-10", endDate: "2026-07-05", note: null }).ok).toBe(false)
  })
})
