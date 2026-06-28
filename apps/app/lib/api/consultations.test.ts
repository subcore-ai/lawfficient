import { describe, expect, test } from "bun:test"

import type { ConsultationView } from "@/lib/consultations/queries"
import { serializeConsultation } from "./consultations"

const view: ConsultationView = {
  id: "consult-1",
  leadId: "lead-9",
  leadName: "Ada Lovelace",
  attorneyId: "att-3",
  attorneyName: "Grace Hopper",
  type: "Initial consultation",
  status: "scheduled",
  startAt: "2026-07-06T14:00:00.000Z",
  durationMin: 30,
  timeZone: "America/New_York",
  paid: false,
  amount: null,
  outcome: null,
  bookedById: "user-1",
  archived: false,
  createdAt: "2026-06-23T10:00:00.000Z",
  data: { language: "Spanish" },
}

describe("serializeConsultation", () => {
  test("produces the stable public shape (snake_case, ids not names)", () => {
    expect(serializeConsultation(view)).toEqual({
      id: "consult-1",
      lead_id: "lead-9",
      attorney_id: "att-3",
      type: "Initial consultation",
      status: "scheduled",
      start_at: "2026-07-06T14:00:00.000Z",
      duration_min: 30,
      time_zone: "America/New_York",
      paid: false,
      amount: null,
      outcome: null,
      archived: false,
      created_at: "2026-06-23T10:00:00.000Z",
      data: { language: "Spanish" },
    })
  })

  test("does not leak internal fields (firm_id, booked_by_id, resolved names)", () => {
    const out = serializeConsultation(view) as Record<string, unknown>
    expect(out.firm_id).toBeUndefined()
    expect(out.bookedById).toBeUndefined()
    expect(out.booked_by_id).toBeUndefined()
    expect(out.leadName).toBeUndefined()
    expect(out.attorneyName).toBeUndefined()
  })

  test("preserves a null lead/attorney and a set amount/outcome", () => {
    const out = serializeConsultation({
      ...view,
      leadId: null,
      attorneyId: null,
      amount: 150,
      outcome: "Retained",
    })
    expect(out.lead_id).toBeNull()
    expect(out.attorney_id).toBeNull()
    expect(out.amount).toBe(150)
    expect(out.outcome).toBe("Retained")
  })
})
