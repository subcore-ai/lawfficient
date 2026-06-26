import { describe, expect, test } from "bun:test"

import { formatConsultationWhen, isValidTimeZone, zonedWallTimeToUtcISO } from "./time"

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
