import { describe, expect, test } from "bun:test"

import {
  addMinutesToTime,
  formatConsultationWhen,
  isValidTimeZone,
  minutesBetween,
  splitWall,
  utcToZonedInput,
  zonedWallTimeToUtcISO,
} from "./time"

describe("zonedWallTimeToUtcISO", () => {
  test("interprets the wall time in the given zone → correct UTC instant (DST)", () => {
    // 3pm EDT (UTC-4 in July) == 19:00 UTC
    expect(zonedWallTimeToUtcISO("2026-07-01T15:00", "America/New_York")).toBe("2026-07-01T19:00:00.000Z")
  })

  test("honors standard time vs DST", () => {
    // 3pm EST (UTC-5 in January) == 20:00 UTC
    expect(zonedWallTimeToUtcISO("2026-01-01T15:00", "America/New_York")).toBe("2026-01-01T20:00:00.000Z")
    // Pacific in July (UTC-7) — 9am == 16:00 UTC
    expect(zonedWallTimeToUtcISO("2026-07-01T09:00", "America/Los_Angeles")).toBe("2026-07-01T16:00:00.000Z")
  })

  test("UTC is a no-op", () => {
    expect(zonedWallTimeToUtcISO("2026-07-01T15:00", "UTC")).toBe("2026-07-01T15:00:00.000Z")
  })

  test("returns null on a malformed wall string or invalid zone", () => {
    expect(zonedWallTimeToUtcISO("not-a-date", "America/New_York")).toBeNull()
    expect(zonedWallTimeToUtcISO("2026-07-01T15:00", "Mars/Phobos")).toBeNull()
  })

  test("rejects out-of-range components instead of silently rolling them over", () => {
    expect(zonedWallTimeToUtcISO("2026-13-01T10:00", "UTC")).toBeNull() // month 13
    expect(zonedWallTimeToUtcISO("2026-02-30T10:00", "UTC")).toBeNull() // Feb 30
    expect(zonedWallTimeToUtcISO("2026-01-01T25:00", "UTC")).toBeNull() // hour 25
  })

  test("rejects a nonexistent spring-forward gap wall time", () => {
    // 2026-03-08: NY springs forward 02:00 -> 03:00, so 02:30 never occurs → reject, don't mis-book.
    expect(zonedWallTimeToUtcISO("2026-03-08T02:30", "America/New_York")).toBeNull()
  })

  test("converts a valid time on a DST-change day", () => {
    // 10:00 on the same spring-forward day is valid (EDT, UTC-4) -> 14:00Z.
    expect(zonedWallTimeToUtcISO("2026-03-08T10:00", "America/New_York")).toBe("2026-03-08T14:00:00.000Z")
  })
})

describe("utcToZonedInput", () => {
  test("renders a UTC instant as the zone's wall time for datetime-local", () => {
    expect(utcToZonedInput("2026-07-01T19:00:00.000Z", "America/New_York")).toBe("2026-07-01T15:00") // 3pm EDT
    expect(utcToZonedInput("2026-01-01T20:00:00.000Z", "America/New_York")).toBe("2026-01-01T15:00") // 3pm EST
  })

  test("round-trips with zonedWallTimeToUtcISO", () => {
    const iso = "2026-07-01T19:00:00.000Z"
    expect(zonedWallTimeToUtcISO(utcToZonedInput(iso, "America/New_York"), "America/New_York")).toBe(iso)
  })

  test("returns empty string on a bad zone or instant", () => {
    expect(utcToZonedInput("2026-07-01T19:00:00.000Z", "Mars/Phobos")).toBe("")
    expect(utcToZonedInput("not-a-date", "America/New_York")).toBe("")
    expect(utcToZonedInput("", "America/New_York")).toBe("")
  })
})

describe("formatConsultationWhen", () => {
  test("renders a UTC instant in the consult's zone (no dateStyle/timeZoneName throw)", () => {
    const out = formatConsultationWhen("2026-07-01T19:00:00.000Z", "America/New_York")
    expect(out).toContain("3:00") // 19:00Z == 3:00 PM EDT
    expect(out).toContain("EDT")
    // Regression guard: combining dateStyle/timeStyle with timeZoneName throws → raw-ISO fallback.
    expect(out).not.toBe("2026-07-01T19:00:00.000Z")
  })

  test("falls back to the raw ISO on a bad zone", () => {
    expect(formatConsultationWhen("2026-07-01T19:00:00.000Z", "Mars/Phobos")).toBe("2026-07-01T19:00:00.000Z")
  })
})

describe("isValidTimeZone", () => {
  test("accepts IANA zones, rejects junk", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true)
    expect(isValidTimeZone("UTC")).toBe(true)
    expect(isValidTimeZone("Mars/Phobos")).toBe(false)
    expect(isValidTimeZone("")).toBe(false)
  })
})

describe("splitWall / addMinutesToTime / minutesBetween (day + from/to form inputs)", () => {
  test("splitWall separates date + time; empty on malformed", () => {
    expect(splitWall("2026-06-29T10:30")).toEqual({ day: "2026-06-29", time: "10:30" })
    expect(splitWall("")).toEqual({ day: "", time: "" })
    expect(splitWall("2026-06-29")).toEqual({ day: "", time: "" })
  })

  test("addMinutesToTime shifts within the day, clamps at 23:59, '' on malformed", () => {
    expect(addMinutesToTime("10:30", 30)).toBe("11:00")
    expect(addMinutesToTime("10:00", 90)).toBe("11:30")
    expect(addMinutesToTime("23:30", 60)).toBe("23:59") // clamped — never wraps into the next day
    expect(addMinutesToTime("bad", 30)).toBe("")
  })

  test("minutesBetween is to − from; ≤0 when not after; NaN on malformed", () => {
    expect(minutesBetween("10:00", "10:30")).toBe(30)
    expect(minutesBetween("09:00", "10:00")).toBe(60)
    expect(minutesBetween("10:30", "10:00")).toBe(-30)
    expect(minutesBetween("10:00", "10:00")).toBe(0)
    expect(Number.isNaN(minutesBetween("x", "10:00"))).toBe(true)
  })
})
