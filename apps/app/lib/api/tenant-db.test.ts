import { describe, expect, test } from "bun:test"

import { tenantScoped } from "./tenant-db"

type Admin = Parameters<typeof tenantScoped>[0]
type Call = { method: string; args: unknown[] }

// A stand-in for the service-role admin client that records the builder chain instead of hitting
// Postgres, so we can assert exactly which predicate the wrapper injects. Every builder method
// returns the same recorder, so `.select(...).match(...).eq(...)…` chains like the real client.
function fakeAdmin() {
  const calls: Call[] = []
  const builder: Record<string, (...args: unknown[]) => unknown> = {}
  for (const method of ["select", "match", "eq", "order", "limit", "or", "maybeSingle"]) {
    builder[method] = (...args) => {
      calls.push({ method, args })
      return builder
    }
  }
  const admin = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] })
      return builder
    },
  }
  return { admin: admin as unknown as Admin, calls }
}

describe("tenantScoped", () => {
  test("from(table) selects all and pins firm_id", () => {
    const { admin, calls } = fakeAdmin()
    tenantScoped(admin, "firm-123").from("leads")
    expect(calls).toEqual([
      { method: "from", args: ["leads"] },
      { method: "select", args: ["*"] },
      { method: "match", args: [{ firm_id: "firm-123" }] },
    ])
  })

  test("injects firm_id for every table it is pointed at", () => {
    const { admin, calls } = fakeAdmin()
    const db = tenantScoped(admin, "firm-abc")
    db.from("leads")
    db.from("lead_statuses")
    expect(calls.filter((c) => c.method === "match")).toEqual([
      { method: "match", args: [{ firm_id: "firm-abc" }] },
      { method: "match", args: [{ firm_id: "firm-abc" }] },
    ])
  })

  test("the firm predicate is applied before any caller-added filter", () => {
    const { admin, calls } = fakeAdmin()
    tenantScoped(admin, "firm-123").from("leads").eq("id", "lead-9").maybeSingle()
    expect(calls.map((c) => c.method)).toEqual(["from", "select", "match", "eq", "maybeSingle"])
    expect(calls[2]).toEqual({ method: "match", args: [{ firm_id: "firm-123" }] }) // before .eq("id", …)
  })

  test("scopes to the firm it was built with — no cross-firm bleed", () => {
    const a = fakeAdmin()
    const b = fakeAdmin()
    tenantScoped(a.admin, "firm-A").from("leads")
    tenantScoped(b.admin, "firm-B").from("leads")
    expect(a.calls).toContainEqual({ method: "match", args: [{ firm_id: "firm-A" }] })
    expect(b.calls).toContainEqual({ method: "match", args: [{ firm_id: "firm-B" }] })
  })

  test("exposes only `from` — no escape hatch to the unscoped admin client", () => {
    const { admin } = fakeAdmin()
    expect(Object.keys(tenantScoped(admin, "firm-123"))).toEqual(["from"])
  })

  test("throws on a missing firmId (the fail-open backstop)", () => {
    const { admin } = fakeAdmin()
    expect(() => tenantScoped(admin, "")).toThrow()
    expect(() => tenantScoped(admin, undefined as unknown as string)).toThrow()
  })
})
