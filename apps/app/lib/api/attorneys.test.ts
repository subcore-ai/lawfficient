import { describe, expect, test } from "bun:test"

import { serializeAttorney, type AttorneyRow } from "./attorneys"

const row: AttorneyRow = {
  id: "att-1",
  name: "Ayesha Okafor",
  email: "ayesha@example.com",
  role: "attorney",
  schedulable: true,
}

describe("serializeAttorney", () => {
  test("produces the stable public shape (id, name, email, role, schedulable, has_office_hours)", () => {
    expect(serializeAttorney(row, true)).toEqual({
      id: "att-1",
      name: "Ayesha Okafor",
      email: "ayesha@example.com",
      role: "attorney",
      schedulable: true,
      has_office_hours: true,
    })
  })

  test("reflects the passed has_office_hours flag (derived, not a row column)", () => {
    expect(serializeAttorney(row, false).has_office_hours).toBe(false)
    expect(serializeAttorney(row, true).has_office_hours).toBe(true)
  })

  test("carries role through so callers can tell an attorney from other schedulable staff", () => {
    const la = { ...row, role: "legal_assistant" } as AttorneyRow
    expect(serializeAttorney(la, true).role).toBe("legal_assistant")
  })

  test("does not leak internal profile fields (firm_id, calendar_color, pod_id)", () => {
    // A full profiles row structurally satisfies AttorneyRow; the serializer must drop the extras.
    const full = {
      ...row,
      firm_id: "firm-1",
      status: "active",
      calendar_color: "#abcdef",
      pod_id: "pod-1",
    } as AttorneyRow
    const out = serializeAttorney(full, true) as Record<string, unknown>
    expect(Object.keys(out).sort()).toEqual([
      "email",
      "has_office_hours",
      "id",
      "name",
      "role",
      "schedulable",
    ])
    expect(out.firm_id).toBeUndefined()
    expect(out.calendar_color).toBeUndefined()
    expect(out.pod_id).toBeUndefined()
  })
})
