import { describe, expect, test } from "bun:test"

import { toE164 } from "./normalize-phone"

describe("toE164", () => {
  test("passes through a valid E.164 number", () => {
    expect(toE164("+14155550123")).toBe("+14155550123")
  })

  test("normalizes a US national-format number (default country)", () => {
    expect(toE164("(415) 555-0123")).toBe("+14155550123")
  })

  test("keeps a valid international number", () => {
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958")
  })

  test("returns null for unparseable / empty input", () => {
    expect(toE164("not a phone")).toBeNull()
    expect(toE164("")).toBeNull()
    expect(toE164(undefined)).toBeNull()
    expect(toE164(12345)).toBeNull()
  })
})
