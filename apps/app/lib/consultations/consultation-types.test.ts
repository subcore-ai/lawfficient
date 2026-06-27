import { describe, expect, test } from "bun:test"

import type { Database } from "@/lib/supabase/database.types"

import { mapConsultationTypeRow, parseConsultationTypeInput } from "./consultation-types"

type Row = Database["public"]["Tables"]["consultation_types"]["Row"]

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "t1",
    firm_id: "f1",
    name: "Initial consultation",
    duration_min: 30,
    price: 0,
    position: 0,
    is_active: true,
    data: {},
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("mapConsultationTypeRow", () => {
  test("snake -> camel", () => {
    const t = mapConsultationTypeRow(row({ name: "Case review", duration_min: 60, price: 150 }))
    expect(t).toEqual({
      id: "t1",
      name: "Case review",
      durationMin: 60,
      price: 150,
      position: 0,
      isActive: true,
    })
  })

  test("coerces a string price (defensive against numeric-as-string drivers)", () => {
    const t = mapConsultationTypeRow(row({ price: "99.5" as unknown as number }))
    expect(t.price).toBe(99.5)
  })
})

describe("parseConsultationTypeInput", () => {
  test("accepts a well-formed type", () => {
    const r = parseConsultationTypeInput({ name: " Case review ", durationMin: "60", price: "150" })
    expect(r).toEqual({ ok: true, value: { name: "Case review", durationMin: 60, price: 150 } })
  })

  test("defaults price to 0 when omitted", () => {
    const r = parseConsultationTypeInput({ name: "Follow-up", durationMin: 30 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ name: "Follow-up", durationMin: 30, price: 0 })
  })

  test("rejects an empty name", () => {
    expect(parseConsultationTypeInput({ name: "  ", durationMin: 30 }).ok).toBe(false)
  })

  test("rejects a non-positive or too-long duration", () => {
    expect(parseConsultationTypeInput({ name: "X", durationMin: 0 }).ok).toBe(false)
    expect(parseConsultationTypeInput({ name: "X", durationMin: 1500 }).ok).toBe(false)
    expect(parseConsultationTypeInput({ name: "X", durationMin: 30.5 }).ok).toBe(false)
  })

  test("rejects a negative price", () => {
    expect(parseConsultationTypeInput({ name: "X", durationMin: 30, price: "-5" }).ok).toBe(false)
  })
})
