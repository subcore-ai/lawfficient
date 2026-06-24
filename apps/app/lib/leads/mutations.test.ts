import { describe, expect, test } from "bun:test"

import { decideUpdateEvents } from "./mutations"

describe("decideUpdateEvents", () => {
  test("no changes → no events", () => {
    expect(decideUpdateEvents({})).toEqual([])
    expect(decideUpdateEvents({ status: false, assignee: false, other: false })).toEqual([])
  })

  test("a core/data change → lead.updated", () => {
    expect(decideUpdateEvents({ other: true })).toEqual(["lead.updated"])
  })

  test("a status change → lead.status_changed (matches setLeadStatus)", () => {
    expect(decideUpdateEvents({ status: true })).toEqual(["lead.status_changed"])
  })

  test("an assignee change → lead.assigned (matches assignLead)", () => {
    expect(decideUpdateEvents({ assignee: true })).toEqual(["lead.assigned"])
  })

  test("a combined change emits the union, deduped, in a stable order", () => {
    expect(decideUpdateEvents({ status: true, assignee: true, other: true })).toEqual([
      "lead.updated",
      "lead.status_changed",
      "lead.assigned",
    ])
  })
})
