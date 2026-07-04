import { describe, expect, test } from "bun:test"

import { isValidEmail } from "./validation"

describe("isValidEmail", () => {
  test("accepts well-formed addresses", () => {
    expect(isValidEmail("a@b.co")).toBe(true)
    expect(isValidEmail("jordan.lee@chidoluelaw.com")).toBe(true)
    expect(isValidEmail("x+tag@sub.domain.io")).toBe(true)
  })

  test("rejects malformed addresses", () => {
    expect(isValidEmail("")).toBe(false)
    expect(isValidEmail("plainaddress")).toBe(false)
    expect(isValidEmail("no-at-sign.com")).toBe(false)
    expect(isValidEmail("a@b")).toBe(false) // domain has no dot
    expect(isValidEmail("two@@at.co")).toBe(false)
    expect(isValidEmail("has space@x.co")).toBe(false)
    expect(isValidEmail("trailing@x.co ")).toBe(false) // not pre-trimmed
  })
})
