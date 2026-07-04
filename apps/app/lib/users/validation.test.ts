import { describe, expect, test } from "bun:test"

import { STAFF_ROLES, normalizeEmail, parseInviteInput, parseRole } from "./validation"

describe("parseRole", () => {
  test("accepts every staff role verbatim", () => {
    for (const r of STAFF_ROLES) expect(parseRole(r)).toBe(r)
  })

  test("rejects unknown strings, wrong case, and non-strings", () => {
    expect(parseRole("ceo")).toBeNull()
    expect(parseRole("Admin")).toBeNull() // case-sensitive
    expect(parseRole("")).toBeNull()
    expect(parseRole(null)).toBeNull()
    expect(parseRole(undefined)).toBeNull()
    expect(parseRole(123)).toBeNull()
    expect(parseRole({ role: "admin" })).toBeNull()
  })
})

describe("normalizeEmail", () => {
  test("trims surrounding whitespace and lowercases", () => {
    expect(normalizeEmail("  Jordan.Lee@Law.COM  ")).toBe("jordan.lee@law.com")
  })

  test("non-strings normalize to an empty string", () => {
    expect(normalizeEmail(null)).toBe("")
    expect(normalizeEmail(undefined)).toBe("")
    expect(normalizeEmail(42)).toBe("")
  })
})

describe("parseInviteInput", () => {
  const ok = { name: "  Jordan Lee  ", email: "  Jordan@Law.com ", role: "attorney" }

  test("trims the name, normalizes the email, returns the role", () => {
    expect(parseInviteInput(ok)).toEqual({
      ok: true,
      value: { name: "Jordan Lee", email: "jordan@law.com", role: "attorney" },
    })
  })

  test("rejects a blank name — and checks the name before email/role", () => {
    expect(parseInviteInput({ ...ok, name: "   " })).toEqual({
      ok: false,
      error: "Name is required.",
    })
    expect(parseInviteInput({ name: "", email: "bad", role: "nope" })).toEqual({
      ok: false,
      error: "Name is required.",
    })
  })

  test("rejects an invalid email", () => {
    expect(parseInviteInput({ ...ok, email: "nope" })).toEqual({
      ok: false,
      error: "Enter a valid email address.",
    })
  })

  test("rejects an invalid role", () => {
    expect(parseInviteInput({ ...ok, role: "wizard" })).toEqual({
      ok: false,
      error: "Choose a valid role.",
    })
  })
})
