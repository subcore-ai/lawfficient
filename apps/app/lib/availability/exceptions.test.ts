import { describe, expect, test } from "bun:test"

import { isDateOff, isValidYmd, mapExceptionRow, parseTimeOffInput } from "./exceptions"

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
  test("accepts a valid range", () => {
    expect(parseTimeOffInput({ startDate: "2026-07-01", endDate: "2026-07-05" })).toEqual({
      ok: true,
      value: { startDate: "2026-07-01", endDate: "2026-07-05" },
    })
  })
  test("a single-day range is allowed", () => {
    expect(parseTimeOffInput({ startDate: "2026-12-25", endDate: "2026-12-25" })).toEqual({
      ok: true,
      value: { startDate: "2026-12-25", endDate: "2026-12-25" },
    })
  })
  test("rejects invalid dates and end-before-start", () => {
    expect(parseTimeOffInput({ startDate: "2026-13-01", endDate: "2026-07-05" }).ok).toBe(false)
    expect(parseTimeOffInput({ startDate: "2026-07-10", endDate: "2026-07-05" }).ok).toBe(false)
  })
})

describe("mapExceptionRow", () => {
  test("maps a DB row to the camelCase TimeOff view", () => {
    expect(
      mapExceptionRow({
        id: "e1",
        firm_id: "f1",
        attorney_id: "a1",
        start_date: "2026-07-01",
        end_date: "2026-07-05",
        created_at: "2026-06-27T00:00:00Z",
      }),
    ).toEqual({ id: "e1", attorneyId: "a1", startDate: "2026-07-01", endDate: "2026-07-05" })
  })
})
