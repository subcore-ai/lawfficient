import { describe, expect, test } from "bun:test"

import {
  formatCurrency,
  formatCurrencyCents,
  formatDate,
  formatDateShort,
  formatDateTime,
  formatTime,
  initialsOf,
  toLocalYmd,
} from "./format"

describe("formatCurrency", () => {
  test("USD with no decimals and thousands separators", () => {
    expect(formatCurrency(7500)).toBe("$7,500")
    expect(formatCurrency(0)).toBe("$0")
    expect(formatCurrency(1234567)).toBe("$1,234,567")
  })
})

describe("formatCurrencyCents", () => {
  test("USD with two decimals", () => {
    expect(formatCurrencyCents(1234.5)).toBe("$1,234.50")
    expect(formatCurrencyCents(0)).toBe("$0.00")
  })
})

describe("formatDate", () => {
  test("formats YYYY-MM-DD as 'Mon D, YYYY'", () => {
    expect(formatDate("2026-06-05")).toBe("Jun 5, 2026")
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026")
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026")
  })

  test("accepts a full ISO string (slices to the date part)", () => {
    expect(formatDate("2026-06-05T15:00:00")).toBe("Jun 5, 2026")
  })

  test("returns the input unchanged when it cannot be parsed", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date")
    expect(formatDate("2026-13-45")).toBe("2026-13-45") // out-of-range month/day
  })
})

describe("formatDateShort", () => {
  test("drops the year", () => {
    expect(formatDateShort("2026-06-05")).toBe("Jun 5")
  })
})

describe("formatDateTime", () => {
  test("combines short date with a 12-hour time", () => {
    expect(formatDateTime("2026-06-05T15:00:00")).toBe("Jun 5, 3:00 PM")
  })

  test("treats midnight as 12:00 AM", () => {
    expect(formatDateTime("2026-06-05T00:00:00")).toBe("Jun 5, 12:00 AM")
  })

  test("returns just the date when there is no time component", () => {
    expect(formatDateTime("2026-06-05")).toBe("Jun 5")
  })

  test("falls back to the date when the time is malformed", () => {
    expect(formatDateTime("2026-06-05Tinvalid")).toBe("Jun 5")
  })
})

describe("formatTime", () => {
  test("formats 12-hour clock with AM/PM and padded minutes", () => {
    expect(formatTime("2026-06-05T15:30:00")).toBe("3:30 PM")
    expect(formatTime("2026-06-05T00:05:00")).toBe("12:05 AM")
    expect(formatTime("2026-06-05T12:00:00")).toBe("12:00 PM")
  })

  test("returns an empty string when there is no time component", () => {
    expect(formatTime("2026-06-05")).toBe("")
  })

  test("returns an empty string when the time is malformed", () => {
    expect(formatTime("2026-06-05Tinvalid")).toBe("")
  })
})

describe("toLocalYmd", () => {
  test("formats a Date's local calendar components as zero-padded YYYY-MM-DD", () => {
    expect(toLocalYmd(new Date(2026, 5, 5))).toBe("2026-06-05") // month is 0-indexed → June
    expect(toLocalYmd(new Date(2026, 11, 31))).toBe("2026-12-31")
    expect(toLocalYmd(new Date(2026, 0, 1))).toBe("2026-01-01")
  })

  test("round-trips with new Date(y, m-1, d)", () => {
    const d = new Date(2026, 6, 13)
    expect(toLocalYmd(d)).toBe("2026-07-13")
  })
})

describe("initialsOf", () => {
  test("takes the first letter of the first two words, uppercased", () => {
    expect(initialsOf("Claudio Fofiu")).toBe("CF")
    expect(initialsOf("sofia cruz reyes")).toBe("SC")
  })

  test("handles a single name", () => {
    expect(initialsOf("Madonna")).toBe("M")
  })

  test("collapses irregular whitespace and handles empty input", () => {
    expect(initialsOf("Claudio  Fofiu")).toBe("CF") // double space
    expect(initialsOf("  Claudio Fofiu  ")).toBe("CF") // leading/trailing
    expect(initialsOf("")).toBe("")
  })
})
