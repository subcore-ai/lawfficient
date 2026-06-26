import { describe, expect, test } from "bun:test"

import { consultationStatusMeta, mapConsultationRow, partitionConsultations, type ConsultationView } from "./queries"
import type { Database } from "@/lib/supabase/database.types"

type ConsultationRow = Database["public"]["Tables"]["consultations"]["Row"]

function row(over: Partial<ConsultationRow> = {}): ConsultationRow {
  return {
    id: "c1",
    firm_id: "firm-1",
    lead_id: "lead-1",
    attorney_id: "att-1",
    type: "Initial consultation",
    paid: false,
    amount: null,
    status: "scheduled",
    start_at: "2026-07-01T15:00:00.000Z",
    duration_min: 30,
    time_zone: "America/New_York",
    booked_by_id: "u1",
    archived: false,
    outcome: null,
    data: {},
    created_at: "2026-06-25T10:00:00.000Z",
    last_activity: "2026-06-25T10:00:00.000Z",
    ...over,
  }
}

const leadNames = new Map([["lead-1", "Ada Lovelace"]])
const profileNames = new Map([["att-1", "Atty Ayesha"]])

describe("mapConsultationRow", () => {
  test("resolves lead + attorney names from the maps", () => {
    const v = mapConsultationRow(row(), leadNames, profileNames)
    expect(v).toMatchObject({ leadName: "Ada Lovelace", attorneyName: "Atty Ayesha", type: "Initial consultation" })
  })

  test("missing/null lead → 'Unknown lead'; null attorney → null", () => {
    expect(mapConsultationRow(row({ lead_id: null }), leadNames, profileNames).leadName).toBe("Unknown lead")
    expect(mapConsultationRow(row({ lead_id: "ghost" }), leadNames, profileNames).leadName).toBe("Unknown lead")
    expect(mapConsultationRow(row({ attorney_id: null }), leadNames, profileNames).attorneyName).toBeNull()
  })

  test("a non-object data jsonb falls back to {}", () => {
    expect(mapConsultationRow(row({ data: "oops" as never }), leadNames, profileNames).data).toEqual({})
    expect(mapConsultationRow(row({ data: { city: "NYC" } }), leadNames, profileNames).data).toEqual({ city: "NYC" })
  })
})

describe("partitionConsultations", () => {
  const now = "2026-07-01T12:00:00.000Z"
  const view = (over: Partial<ConsultationRow>): ConsultationView =>
    mapConsultationRow(row(over), leadNames, profileNames)

  test("future + not-done → upcoming; sorted soonest-first", () => {
    const a = view({ id: "a", start_at: "2026-07-05T10:00:00.000Z" })
    const b = view({ id: "b", start_at: "2026-07-02T10:00:00.000Z" })
    const { upcoming, past } = partitionConsultations([a, b], now)
    expect(upcoming.map((c) => c.id)).toEqual(["b", "a"])
    expect(past).toHaveLength(0)
  })

  test("past start → past; most-recent-first", () => {
    const a = view({ id: "a", start_at: "2026-06-20T10:00:00.000Z" })
    const b = view({ id: "b", start_at: "2026-06-28T10:00:00.000Z" })
    const { upcoming, past } = partitionConsultations([a, b], now)
    expect(past.map((c) => c.id)).toEqual(["b", "a"])
    expect(upcoming).toHaveLength(0)
  })

  test("a future consult that is canceled/completed/no_show counts as past", () => {
    const future = "2026-07-09T10:00:00.000Z"
    const canceled = view({ id: "x", start_at: future, status: "canceled" })
    const done = view({ id: "y", start_at: future, status: "completed" })
    const live = view({ id: "z", start_at: future, status: "scheduled" })
    const { upcoming, past } = partitionConsultations([canceled, done, live], now)
    expect(upcoming.map((c) => c.id)).toEqual(["z"])
    expect(past.map((c) => c.id).sort()).toEqual(["x", "y"])
  })
})

describe("consultationStatusMeta", () => {
  test("every status has a label + tone", () => {
    expect(consultationStatusMeta("completed")).toEqual({ label: "Completed", tone: "success" })
    expect(consultationStatusMeta("no_show").tone).toBe("danger")
  })
})
