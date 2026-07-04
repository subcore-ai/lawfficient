import { describe, expect, test } from "bun:test"

import { LEAD_SOURCES, parseLeadInput, parseLeadPatch } from "./validation"

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

describe("parseLeadPatch", () => {
  const existing = { phone: "555-0100", email: "old@example.com" }

  test("only touches keys PRESENT in the body; absent keys stay undefined", () => {
    const r = parseLeadPatch({ first_name: "Grace" }, existing)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual({ firstName: "Grace" })
      expect("lastName" in r.value).toBe(false)
      expect("phone" in r.value).toBe(false)
    }
  })

  test("trims + lowercases a provided email; validates its shape", () => {
    const ok = parseLeadPatch({ email: "  New@Example.COM " }, existing)
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value.email).toBe("new@example.com")

    expect(parseLeadPatch({ email: "nope" }, existing)).toEqual({
      ok: false,
      error: "Enter a valid email address.",
    })
  })

  test("a provided name/source can't be blanked", () => {
    expect(parseLeadPatch({ first_name: "  " }, existing)).toEqual({
      ok: false,
      error: "First name can't be empty.",
    })
    expect(parseLeadPatch({ source: "" }, existing)).toEqual({
      ok: false,
      error: "Source can't be empty.",
    })
  })

  test("can't blank the LAST contact method (post-merge reachability)", () => {
    // Clearing email when the existing phone is also being cleared → unreachable → rejected.
    expect(parseLeadPatch({ email: "", phone: "" }, existing)).toEqual({
      ok: false,
      error: "Add a phone number or an email.",
    })
    // Clearing only email is fine — the existing phone remains.
    const ok = parseLeadPatch({ email: "" }, existing)
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value.email).toBe("")
  })

  test("clearing the email is allowed when a phone is provided in the same patch", () => {
    const r = parseLeadPatch({ email: "", phone: "555-0199" }, { phone: "", email: "old@example.com" })
    expect(r.ok).toBe(true)
    if (r.ok) expect([r.value.email, r.value.phone]).toEqual(["", "555-0199"])
  })

  test("assignee_id: a string assigns, null/empty unassigns, absent is untouched", () => {
    const assign = parseLeadPatch({ assignee_id: "  staff-1  " }, existing)
    if (assign.ok) expect(assign.value.assignedToId).toBe("staff-1")

    const unassignNull = parseLeadPatch({ assignee_id: null }, existing)
    if (unassignNull.ok) expect(unassignNull.value.assignedToId).toBeNull()

    const unassignEmpty = parseLeadPatch({ assignee_id: "" }, existing)
    if (unassignEmpty.ok) expect(unassignEmpty.value.assignedToId).toBeNull()

    const absent = parseLeadPatch({ first_name: "X" }, existing)
    if (absent.ok) expect("assignedToId" in absent.value).toBe(false)
  })

  test("an empty patch is valid and changes nothing (status/data handled by the route, not here)", () => {
    expect(parseLeadPatch({}, existing)).toEqual({ ok: true, value: {} })
  })
})

describe("LEAD_SOURCES", () => {
  test("sources are the picker vocabulary (free text in the DB)", () => {
    expect(LEAD_SOURCES).toContain("WhatsApp")
    expect(LEAD_SOURCES.length).toBe(6)
  })
})
