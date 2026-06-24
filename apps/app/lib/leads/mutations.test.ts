import { describe, expect, test } from "bun:test"

import { createLeadViaApi, decideUpdateEvents } from "./mutations"
import type { createAdminClient } from "@/lib/supabase/admin"

type Admin = ReturnType<typeof createAdminClient>

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

// createLeadViaApi orchestrates: validate → load vocab → find first open stage → load status map →
// call the api_create_lead RPC → serialize + decide events. The RPC's atomic create/idempotency is
// integration-tested against the DB; here we fake the admin client to cover the RPC-RESULT handling
// (replay vs create, and error → status mapping) which is the new TS glue.
const STATUS = { id: "st1", firm_id: "firm-1", key: "new", name: "New", tone: "info", is_terminal: false, position: 0 }
const LEAD_ROW = {
  id: "lead-1",
  firm_id: "firm-1",
  first_name: "Ada",
  last_name: "Lovelace",
  phone: "",
  email: "ada@x.com",
  source: "Website",
  external_id: null,
  assigned_to_id: null,
  status_id: "st1",
  archived: false,
  created_at: "2026-01-01T00:00:00+00:00",
  last_activity: "2026-01-01T00:00:00+00:00",
  data: {},
}
const INPUT = { firstName: "Ada", lastName: "Lovelace", email: "ada@x.com", source: "Website" }

// Chainable stub: firm_taxonomies + lead_statuses (both the stage `.maybeSingle()` and the status-map
// `.order()` await resolve off the same builder) and `.rpc()`.
function fakeAdmin(opts: {
  vocab?: { data: unknown; error: unknown }
  stage?: { data: unknown; error: unknown }
  statuses?: { data: unknown; error: unknown }
  rpc?: { data: unknown; error: unknown }
}) {
  const vocab = opts.vocab ?? { data: [], error: null }
  const stage = opts.stage ?? { data: { id: "st1" }, error: null }
  const statuses = opts.statuses ?? { data: [STATUS], error: null }
  const rpc = opts.rpc ?? { data: [{ ...LEAD_ROW, replayed: false }], error: null }
  const admin = {
    from(table: string) {
      const builder: Record<string, (...a: unknown[]) => unknown> = {}
      builder.select = () => builder
      builder.eq = () => builder
      builder.limit = () => builder
      builder.maybeSingle = () => Promise.resolve(stage)
      // `.order()` is the await point for firm_taxonomies (vocab) and the lead_statuses map; it also
      // chains to `.limit().maybeSingle()` for the stage lookup.
      builder.order = () => ({
        limit: () => ({ maybeSingle: () => Promise.resolve(stage) }),
        then: (onF: (v: unknown) => unknown) =>
          Promise.resolve(table === "firm_taxonomies" ? vocab : statuses).then(onF),
      })
      return builder
    },
    rpc: () => Promise.resolve(rpc),
  }
  return admin as unknown as Admin
}

describe("createLeadViaApi (RPC result handling)", () => {
  test("a fresh create → ok + emits lead.created", async () => {
    const res = await createLeadViaApi(fakeAdmin({}), "firm-1", INPUT)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.events).toEqual(["lead.created"])
      expect(res.lead.id).toBe("lead-1")
    }
  })

  test("an idempotent REPLAY (replayed=true) → ok but emits NOTHING (no duplicate lead.created)", async () => {
    const admin = fakeAdmin({ rpc: { data: [{ ...LEAD_ROW, replayed: true }], error: null } })
    const res = await createLeadViaApi(admin, "firm-1", INPUT, { apiKeyId: "key-1", key: "idem-1" })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.events).toEqual([])
  })

  test("a bad assignee (FK 23503 from the RPC) → 422", async () => {
    const admin = fakeAdmin({ rpc: { data: null, error: { code: "23503" } } })
    const res = await createLeadViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 422, code: "invalid_request" })
  })

  test("any other RPC error → 500", async () => {
    const admin = fakeAdmin({ rpc: { data: null, error: { code: "55000" } } })
    const res = await createLeadViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 500 })
  })

  test("RPC returns no row → 500", async () => {
    const admin = fakeAdmin({ rpc: { data: [], error: null } })
    const res = await createLeadViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 500 })
  })

  test("no open pipeline stage → 409", async () => {
    const admin = fakeAdmin({ stage: { data: null, error: null } })
    const res = await createLeadViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 409, code: "no_open_stage" })
  })

  test("status-map load failure → 503 (before the RPC)", async () => {
    const admin = fakeAdmin({ statuses: { data: null, error: { message: "boom" } } })
    const res = await createLeadViaApi(admin, "firm-1", INPUT)
    expect(res).toMatchObject({ ok: false, status: 503 })
  })

  test("invalid input (no contact method) → 422 before any DB call", async () => {
    const res = await createLeadViaApi(fakeAdmin({}), "firm-1", { firstName: "A", lastName: "B", source: "Website" })
    expect(res).toMatchObject({ ok: false, status: 422 })
  })

  test("throws on a missing firmId (fail-open backstop)", async () => {
    await expect(createLeadViaApi(fakeAdmin({}), "", INPUT)).rejects.toThrow()
  })
})
