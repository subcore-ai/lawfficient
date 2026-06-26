import { describe, expect, test } from "bun:test"

import type { Database } from "@/lib/supabase/database.types"

import { groupByWeekday, mapAvailabilityRow, toHm, type AvailabilityWindow } from "./queries"

type AvailabilityRow = Database["public"]["Tables"]["attorney_availability"]["Row"]

function row(overrides: Partial<AvailabilityRow> = {}): AvailabilityRow {
  return {
    id: "a1",
    firm_id: "f1",
    attorney_id: "att1",
    weekday: 1,
    start_time: "09:00:00",
    end_time: "17:00:00",
    data: {},
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("toHm", () => {
  test("trims pg time to HH:MM", () => {
    expect(toHm("09:00:00")).toBe("09:00")
    expect(toHm("13:30")).toBe("13:30")
  })
})

describe("mapAvailabilityRow", () => {
  test("snake -> camel and trims times to the minute", () => {
    const w = mapAvailabilityRow(row({ weekday: 3, start_time: "08:15:00", end_time: "12:45:00" }))
    expect(w).toEqual({ id: "a1", attorneyId: "att1", weekday: 3, startTime: "08:15", endTime: "12:45" })
  })
})

describe("groupByWeekday", () => {
  test("buckets by day (index = weekday), each sorted by start", () => {
    const ws: AvailabilityWindow[] = [
      { id: "1", attorneyId: "a", weekday: 1, startTime: "13:00", endTime: "17:00" },
      { id: "2", attorneyId: "a", weekday: 1, startTime: "09:00", endTime: "12:00" },
      { id: "3", attorneyId: "a", weekday: 5, startTime: "10:00", endTime: "11:00" },
    ]
    const days = groupByWeekday(ws)
    expect(days).toHaveLength(7)
    expect(days[1]?.map((w) => w.startTime)).toEqual(["09:00", "13:00"])
    expect(days[5]).toHaveLength(1)
    expect(days[0]).toEqual([])
  })

  test("drops out-of-range weekdays", () => {
    const days = groupByWeekday([{ id: "x", attorneyId: "a", weekday: 9, startTime: "09:00", endTime: "10:00" }])
    expect(days.flat()).toEqual([])
  })
})
