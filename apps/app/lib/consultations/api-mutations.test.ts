import { describe, expect, test } from "bun:test"

import type { createAdminClient } from "@/lib/supabase/admin"
import {
  createConsultationViaApi,
  decideConsultationEvents,
  updateConsultationViaApi,
} from "./api-mutations"

type Admin = ReturnType<typeof createAdminClient>

const CONSULT_ID = "33333333-3333-3333-3333-333333333333"

// The row shape both booking RPCs return (api_book_consultation / api_update_consultation).
const ROW = {
  id: CONSULT_ID,
  firm_id: "firm-1",
  lead_id: "lead-1",
  attorney_id: "att-1",
  type: "Initial",
  status: "scheduled" as const,
  start_at: "2026-07-06T14:00:00+00:00",
  duration_min: 30,
  time_zone: "America/New_York",
  paid: false,
  amount: null,
  outcome: null,
  archived: false,
  created_at: "2026-06-23T10:00:00+00:00",
  last_activity: "2026-06-23T10:00:00+00:00",
  data: {},
  replayed: false,
}

const LEAD_ID = "11111111-1111-1111-1111-111111111111"
const ATTORNEY_ID = "22222222-2222-2222-2222-222222222222"

// Minimal valid booking input (real UUIDs so the pre-RPC validators pass).
const INPUT = {
  leadId: LEAD_ID,
  attorneyId: ATTORNEY_ID,
  type: "Initial",
  startAt: "2026-07-06T14:00:00.000Z",
  durationMin: 30,
  timeZone: "America/New_York",
  paid: false,
  amount: null,
}

// The only DB call either mutation makes is `.rpc()` — so the fake just returns a canned RPC result.
function fakeAdmin(rpc: { data: unknown; error: unknown }) {
  return { rpc: () => Promise.resolve(rpc) } as unknown as Admin
}

describe("decideConsultationEvents", () => {
  test("nothing → no events", () => {
    expect(decideConsultationEvents({ rescheduled: false, canceled: false })).toEqual([])
  })
  test("reschedule → consultation.rescheduled", () => {
    expect(decideConsultationEvents({ rescheduled: true, canceled: false })).toEqual([
      "consultation.rescheduled",
    ])
  })
  test("cancel → consultation.canceled", () => {
    expect(decideConsultationEvents({ rescheduled: false, canceled: true })).toEqual([
      "consultation.canceled",
    ])
  })
  test("cancel wins over a simultaneous reschedule", () => {
    expect(decideConsultationEvents({ rescheduled: true, canceled: true })).toEqual([
      "consultation.canceled",
    ])
  })
})

describe("createConsultationViaApi (RPC result handling)", () => {
  test("a fresh booking → ok + emits consultation.booked", async () => {
    const res = await createConsultationViaApi(fakeAdmin({ data: [ROW], error: null }), "firm-1", INPUT)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.events).toEqual(["consultation.booked"])
      expect(res.consultation.id).toBe(CONSULT_ID)
      // The internal `replayed` flag never leaks into the public shape.
      expect((res.consultation as Record<string, unknown>).replayed).toBeUndefined()
      expect((res.consultation as Record<string, unknown>).firm_id).toBeUndefined()
    }
  })

  test("an idempotent REPLAY (replayed=true) → ok but emits NOTHING", async () => {
    const admin = fakeAdmin({ data: [{ ...ROW, replayed: true }], error: null })
    const res = await createConsultationViaApi(admin, "firm-1", INPUT, { apiKeyId: "key-1", key: "idem-1" })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.events).toEqual([])
  })

  test("a taken slot (exclusion 23P01) → 409 slot_unavailable", async () => {
    const admin = fakeAdmin({ data: null, error: { code: "23P01", message: "conflicting key" } })
    const res = await createConsultationViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 409, code: "slot_unavailable" })
  })

  test("outside office hours (labeled 23514) → 422 outside_office_hours", async () => {
    const admin = fakeAdmin({ data: null, error: { code: "23514", message: "outside_office_hours" } })
    const res = await createConsultationViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 422, code: "outside_office_hours" })
  })

  test("attorney on time-off (labeled 23514) → 422 attorney_unavailable", async () => {
    const admin = fakeAdmin({ data: null, error: { code: "23514", message: "attorney_unavailable" } })
    const res = await createConsultationViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 422, code: "attorney_unavailable" })
  })

  test("non-bookable attorney (labeled 23514) → 422 invalid_request", async () => {
    const admin = fakeAdmin({ data: null, error: { code: "23514", message: "attorney_not_bookable" } })
    const res = await createConsultationViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 422, code: "invalid_request" })
  })

  test("wrong-firm lead/attorney (FK 23503) → 422", async () => {
    const admin = fakeAdmin({ data: null, error: { code: "23503", message: "fk" } })
    const res = await createConsultationViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 422, code: "invalid_request" })
  })

  test("an unmapped RPC error → 500", async () => {
    const admin = fakeAdmin({ data: null, error: { code: "55000", message: "boom" } })
    const res = await createConsultationViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 500 })
  })

  test("RPC returns no row → 500", async () => {
    const res = await createConsultationViaApi(fakeAdmin({ data: [], error: null }), "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 500 })
  })

  test("missing attorney_id → 422 before any DB call", async () => {
    const res = await createConsultationViaApi(fakeAdmin({ data: [ROW], error: null }), "firm-1", {
      ...INPUT,
      attorneyId: null,
    })
    expect(res).toMatchObject({ ok: false, status: 422 })
  })

  test("non-UUID lead_id → 422 before any DB call", async () => {
    const res = await createConsultationViaApi(fakeAdmin({ data: [ROW], error: null }), "firm-1", {
      ...INPUT,
      leadId: "not-a-uuid",
    })
    expect(res).toMatchObject({ ok: false, status: 422 })
  })

  test("a non-object data → 422", async () => {
    const res = await createConsultationViaApi(fakeAdmin({ data: [ROW], error: null }), "firm-1", {
      ...INPUT,
      data: "nope",
    })
    expect(res).toMatchObject({ ok: false, status: 422 })
  })

  test("throws on a missing firmId (fail-open backstop)", async () => {
    await expect(createConsultationViaApi(fakeAdmin({ data: [ROW], error: null }), "", INPUT)).rejects.toThrow()
  })
})

describe("updateConsultationViaApi (RPC result handling)", () => {
  test("a reschedule → ok + emits consultation.rescheduled", async () => {
    const admin = fakeAdmin({ data: [{ ...ROW, status: "rescheduled" }], error: null })
    const res = await updateConsultationViaApi(admin, "firm-1", ROW.id, {
      start_at: "2026-07-06T15:00:00.000Z",
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.events).toEqual(["consultation.rescheduled"])
  })

  test("a cancel → ok + emits consultation.canceled", async () => {
    const admin = fakeAdmin({ data: [{ ...ROW, status: "canceled" }], error: null })
    const res = await updateConsultationViaApi(admin, "firm-1", ROW.id, { status: "canceled" })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.events).toEqual(["consultation.canceled"])
  })

  test("a non-cancel status (completed) → 422 (only cancel is exposed)", async () => {
    const admin = fakeAdmin({ data: [ROW], error: null })
    const res = await updateConsultationViaApi(admin, "firm-1", ROW.id, { status: "completed" })
    expect(res).toMatchObject({ ok: false, status: 422 })
  })

  test("an empty patch → 422 (nothing to update)", async () => {
    const res = await updateConsultationViaApi(fakeAdmin({ data: [ROW], error: null }), "firm-1", ROW.id, {})
    expect(res).toMatchObject({ ok: false, status: 422 })
  })

  test("no row returned (finalized / not this firm / missing) → 404", async () => {
    const res = await updateConsultationViaApi(fakeAdmin({ data: [], error: null }), "firm-1", ROW.id, {
      start_at: "2026-07-06T15:00:00.000Z",
    })
    expect(res).toMatchObject({ ok: false, status: 404, code: "not_found" })
  })

  test("a taken slot on reschedule (23P01) → 409 slot_unavailable", async () => {
    const admin = fakeAdmin({ data: null, error: { code: "23P01", message: "conflict" } })
    const res = await updateConsultationViaApi(admin, "firm-1", ROW.id, {
      start_at: "2026-07-06T15:00:00.000Z",
    })
    expect(res).toMatchObject({ ok: false, status: 409, code: "slot_unavailable" })
  })

  test("a non-UUID id → 404 before any DB call", async () => {
    const res = await updateConsultationViaApi(fakeAdmin({ data: [ROW], error: null }), "firm-1", "nope", {
      status: "canceled",
    })
    expect(res).toMatchObject({ ok: false, status: 404 })
  })
})
