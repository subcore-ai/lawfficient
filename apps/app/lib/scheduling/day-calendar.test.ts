import { describe, expect, test } from "bun:test"

import { buildDayCalendar, draggedStartMin, minToHhmm, weekDatesOf, weekStartOf, weekdayOf } from "./day-calendar"

describe("weekdayOf", () => {
  test("computes the weekday of a calendar date (0=Sun..6=Sat)", () => {
    expect(weekdayOf("2021-01-01")).toBe(5) // Friday
    expect(weekdayOf("2000-01-01")).toBe(6) // Saturday
  })
})

describe("weekStartOf / weekDatesOf", () => {
  test("weekStartOf returns the Monday on or before the date", () => {
    expect(weekStartOf("2026-07-01")).toBe("2026-06-29") // Wednesday → that week's Monday
    expect(weekStartOf("2026-06-29")).toBe("2026-06-29") // a Monday → itself
    expect(weekStartOf("2026-07-05")).toBe("2026-06-29") // a Sunday → the week's Monday (not the next one)
  })
  test("weekDatesOf lists the 7 Mon..Sun dates of the week", () => {
    expect(weekDatesOf("2026-07-01")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ])
  })
})

describe("draggedStartMin", () => {
  const px = 1.1 // PX_PER_MIN
  test("snaps a vertical drag to 15-minute steps", () => {
    expect(draggedStartMin(600, 33, px)).toBe(630) // +30px ≈ +27min → snaps to +30
    expect(draggedStartMin(600, -33, px)).toBe(570) // up → -30
    expect(draggedStartMin(600, 8, px)).toBe(600) // ~7min → snaps to 0 (no move)
    expect(draggedStartMin(600, 17, px)).toBe(615) // ~15min → +15
  })
  test("clamps within the day (never before midnight or past it)", () => {
    expect(draggedStartMin(10, -1000, px)).toBe(0)
    expect(draggedStartMin(1430, 1000, px)).toBe(1439)
  })
})

describe("minToHhmm", () => {
  test("formats minutes-of-day as zero-padded 24h HH:MM", () => {
    expect(minToHhmm(0)).toBe("00:00")
    expect(minToHhmm(587)).toBe("09:47")
    expect(minToHhmm(600)).toBe("10:00")
    expect(minToHhmm(1439)).toBe("23:59")
  })
})

describe("buildDayCalendar (America/New_York, summer = EDT, UTC-4)", () => {
  const tz = "America/New_York"
  const date = "2026-07-01"

  test("windows + consults + free slots resolve to firm-tz wall minutes", () => {
    const cal = buildDayCalendar({
      date,
      tz,
      windows: [{ startTime: "09:00", endTime: "12:00" }],
      // 14:00Z = 10:00 EDT
      consults: [
        { id: "c1", startAt: "2026-07-01T14:00:00Z", durationMin: 30, leadName: "Maria", type: "Initial", status: "scheduled", leadId: "l1", timeZone: tz, outcome: null },
      ],
      durationMin: 30,
      nowMs: 0,
    })
    expect(cal.windows).toEqual([{ startMin: 540, endMin: 720 }]) // 9:00–12:00
    // 10:00–10:30 EDT, with the detail-dialog metadata passed through unchanged.
    expect(cal.consults[0]).toMatchObject({
      startMin: 600,
      endMin: 630,
      leadName: "Maria",
      status: "scheduled",
      leadId: "l1",
      startAt: "2026-07-01T14:00:00Z",
      timeZone: tz,
      outcome: null,
    })
    // 30-min slots 9–12 minus the 10:00–10:30 booking: 9:00, 9:30, 10:30, 11:00, 11:30
    expect(cal.slots.map((s) => s.startMin)).toEqual([540, 570, 630, 660, 690])
    expect(cal.slots[0]?.startInput).toBe("2026-07-01T09:00") // datetime-local prefill is the NY wall time
  })

  test("grid widens to fit early/late hours, else defaults 8–18", () => {
    const wide = buildDayCalendar({ date, tz, windows: [{ startTime: "07:00", endTime: "20:00" }], consults: [], durationMin: 60, nowMs: 0 })
    expect(wide.gridStartMin).toBe(7 * 60)
    expect(wide.gridEndMin).toBe(20 * 60)

    const empty = buildDayCalendar({ date, tz, windows: [], consults: [], durationMin: 30, nowMs: 0 })
    expect(empty.gridStartMin).toBe(8 * 60)
    expect(empty.gridEndMin).toBe(18 * 60)
    expect(empty.slots).toEqual([])
  })

  test("a consult that started the prior day blocks this morning's slots but isn't shown", () => {
    const cal = buildDayCalendar({
      date,
      tz,
      windows: [{ startTime: "00:00", endTime: "01:00" }], // hours straddling midnight so the carry-over overlaps
      // 03:30Z = 23:30 EDT on Jun 30 (prior day), 60 min → runs to 00:30 EDT Jul 1
      consults: [{ id: "carry", startAt: "2026-07-01T03:30:00Z", durationMin: 60, leadName: "Owl", type: "Initial", status: "scheduled", leadId: "l2", timeZone: tz, outcome: null }],
      durationMin: 30,
      nowMs: 0,
    })
    expect(cal.consults).toEqual([]) // not shown — belongs to the prior day's grid
    expect(cal.slots.map((s) => s.startMin)).toEqual([30]) // 00:00 slot blocked, 00:30 free
  })
})
