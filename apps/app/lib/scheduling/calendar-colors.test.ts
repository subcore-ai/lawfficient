import { describe, expect, test } from "bun:test"

import { CALENDAR_COLORS, colorFor, isValidColorKey } from "./calendar-colors"

describe("calendar colors", () => {
  test("15 entries, unique keys, complete hex fields", () => {
    expect(CALENDAR_COLORS).toHaveLength(15)
    expect(new Set(CALENDAR_COLORS.map((c) => c.key)).size).toBe(15)
    for (const c of CALENDAR_COLORS) {
      expect(c.solid).toMatch(/^#[0-9a-f]{6}$/)
      expect(c.text).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  test("colorFor resolves a known key; null / undefined / unknown → null", () => {
    expect(colorFor("rose")?.key).toBe("rose")
    expect(colorFor(null)).toBeNull()
    expect(colorFor(undefined)).toBeNull()
    expect(colorFor("not-a-color")).toBeNull()
  })

  test("isValidColorKey", () => {
    expect(isValidColorKey("teal")).toBe(true)
    expect(isValidColorKey("nope")).toBe(false)
  })
})
