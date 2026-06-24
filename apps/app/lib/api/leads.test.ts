import { describe, expect, test } from "bun:test"

import type { LeadView } from "@/lib/leads/queries"
import { serializeLead } from "./leads"

const lead: LeadView = {
  id: "lead-1",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: "+15555550123",
  email: "ada@example.com",
  source: "zapier",
  assignedToId: "staff-9",
  status: { id: "status-1", key: "new", name: "New", tone: "info", isTerminal: false, position: 0 },
  archived: false,
  createdAt: "2026-06-23T10:00:00.000Z",
  lastActivity: "2026-06-23T11:00:00.000Z",
  data: { caseType: "Immigration", city: "Austin" },
}

describe("serializeLead", () => {
  test("produces the stable public shape (snake_case, status by key+name)", () => {
    expect(serializeLead(lead)).toEqual({
      id: "lead-1",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      phone: "+15555550123",
      source: "zapier",
      status: { key: "new", name: "New" },
      assignee_id: "staff-9",
      archived: false,
      created_at: "2026-06-23T10:00:00.000Z",
      last_activity_at: "2026-06-23T11:00:00.000Z",
      data: { caseType: "Immigration", city: "Austin" },
    })
  })

  test("does not leak internal fields (firm_id, status_id, internal tone/position)", () => {
    const out = serializeLead(lead) as Record<string, unknown>
    expect(out.firm_id).toBeUndefined()
    expect(out.status_id).toBeUndefined()
    expect(out.assignedToId).toBeUndefined() // camelCase internal name absent
    expect(out.status).toEqual({ key: "new", name: "New" }) // no tone/position/id
  })

  test("preserves a null assignee", () => {
    expect(serializeLead({ ...lead, assignedToId: null }).assignee_id).toBeNull()
  })
})
