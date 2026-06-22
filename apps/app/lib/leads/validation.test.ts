import { describe, expect, test } from "bun:test"

import { isValidEmail, LEAD_SOURCES, parseLeadInput } from "./validation"

describe("parseLeadInput", () => {
  const base = { firstName: "Ada", lastName: "Lovelace", phone: "555-0100", source: "Website" }

  test("accepts a valid lead — lowercases email, nulls an empty assignee", () => {
    const r = parseLeadInput({ ...base, email: "Ada@Example.COM", assignedToId: "" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.email).toBe("ada@example.com")
      expect(r.value.assignedToId).toBeNull()
    }
  })

  test("requires first + last name", () => {
    expect(parseLeadInput({ ...base, firstName: "  " })).toEqual({
      ok: false,
      error: "First and last name are required.",
    })
  })

  test("requires at least a phone or an email", () => {
    expect(parseLeadInput({ firstName: "A", lastName: "B", source: "Website" })).toEqual({
      ok: false,
      error: "Add a phone number or an email.",
    })
  })

  test("validates email shape when one is given", () => {
    expect(parseLeadInput({ ...base, email: "bad" })).toEqual({
      ok: false,
      error: "Enter a valid email address.",
    })
  })

  test("requires a source", () => {
    expect(parseLeadInput({ ...base, source: "" })).toEqual({ ok: false, error: "Choose a source." })
  })
})

describe("LEAD_SOURCES / isValidEmail", () => {
  test("sources are the picker vocabulary (free text in the DB)", () => {
    expect(LEAD_SOURCES).toContain("WhatsApp")
    expect(LEAD_SOURCES.length).toBe(6)
  })

  test("email regex catches obvious mistakes", () => {
    expect(isValidEmail("a@b.co")).toBe(true)
    expect(isValidEmail("nope")).toBe(false)
    expect(isValidEmail("a@b")).toBe(false)
  })
})
