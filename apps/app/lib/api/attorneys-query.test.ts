import { describe, expect, test } from "bun:test"

import { getApiAttorneys } from "./attorneys-query"
import type { TenantDb } from "./tenant-db"

type Result = { data: unknown[] | null; error: unknown }

// A stand-in for the tenant-scoped DB handle. Each `from(table)` returns a builder that resolves
// (thenable) to the preset result for that table, so we can drive getApiAttorneys's two reads
// (profiles, then attorney_availability) without Postgres. Chained filters (.eq/.in/.order) are
// no-ops that return the same builder, matching the real PostgREST chain.
function fakeDb(results: Record<string, Result>): TenantDb {
  const from = (table: string) => {
    const result = results[table] ?? { data: [], error: null }
    const builder: Record<string, unknown> = {
      then: (resolve: (r: Result) => unknown) => resolve(result),
    }
    for (const method of ["eq", "in", "order"]) builder[method] = () => builder
    return builder
  }
  return { from } as unknown as TenantDb
}

const row = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@example.com`,
  role: "attorney",
  schedulable: true,
})

describe("getApiAttorneys", () => {
  test("empty roster → empty page, and skips the availability read (fast path)", async () => {
    // attorney_availability is armed to error: if the empty-roster fast path in
    // attorneysWithOfficeHours didn't short-circuit, this read would run and surface the error.
    const db = fakeDb({
      profiles: { data: [], error: null },
      attorney_availability: { data: null, error: new Error("should not be read") },
    })
    expect(await getApiAttorneys(db)).toEqual({ data: [], next_cursor: null })
  })

  test("annotates has_office_hours per attorney (true only for ids with a window)", async () => {
    const db = fakeDb({
      profiles: { data: [row("a1", "Ayesha"), row("a2", "Stacey")], error: null },
      attorney_availability: { data: [{ attorney_id: "a1" }], error: null },
    })
    const page = await getApiAttorneys(db)
    expect(page.next_cursor).toBeNull()
    expect(page.data.map((a) => [a.id, a.has_office_hours])).toEqual([
      ["a1", true],
      ["a2", false],
    ])
  })

  test("?has_office_hours=true drops attorneys with no office-hours window", async () => {
    const db = fakeDb({
      profiles: { data: [row("a1", "Ayesha"), row("a2", "Stacey")], error: null },
      attorney_availability: { data: [{ attorney_id: "a1" }], error: null },
    })
    const page = await getApiAttorneys(db, { hasOfficeHours: true })
    expect(page.data.map((a) => a.id)).toEqual(["a1"])
  })

  test("propagates a profiles read error", async () => {
    const db = fakeDb({ profiles: { data: null, error: new Error("profiles boom") } })
    await expect(getApiAttorneys(db)).rejects.toThrow("profiles boom")
  })

  test("propagates an attorney_availability read error", async () => {
    const db = fakeDb({
      profiles: { data: [row("a1", "Ayesha")], error: null },
      attorney_availability: { data: null, error: new Error("availability boom") },
    })
    await expect(getApiAttorneys(db)).rejects.toThrow("availability boom")
  })
})
