import { describe, expect, test } from "bun:test"

import { serializeAttorney, type AttorneyRow } from "./attorneys"

const row: AttorneyRow = {
  id: "att-1",
  name: "Ayesha Okafor",
  schedulable: true,
}

describe("serializeAttorney", () => {
  test("produces the stable public shape (id, name, schedulable)", () => {
    expect(serializeAttorney(row)).toEqual({
      id: "att-1",
      name: "Ayesha Okafor",
      schedulable: true,
    })
  })

  test("does not leak internal profile fields (firm_id, email, role)", () => {
    // A full profiles row structurally satisfies AttorneyRow; the serializer must drop the extras.
    const full = {
      ...row,
      firm_id: "firm-1",
      email: "ayesha@example.com",
      role: "attorney",
      status: "active",
      calendar_color: "#abcdef",
    } as AttorneyRow
    const out = serializeAttorney(full) as Record<string, unknown>
    expect(Object.keys(out).sort()).toEqual(["id", "name", "schedulable"])
    expect(out.firm_id).toBeUndefined()
    expect(out.email).toBeUndefined()
    expect(out.role).toBeUndefined()
  })
})
