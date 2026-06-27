import { describe, expect, test } from "bun:test"

import { generateSlots, type Interval } from "./slots"

const MIN = 60_000
const H = 60 * MIN
const DAY = 1_700_000_000_000 // fixed reference instant so values are easy to reason about

function at(h: number, m = 0): number {
  return DAY + h * H + m * MIN
}
function win(h1: number, h2: number): Interval {
  return { start: at(h1), end: at(h2) }
}
function slotHours(slots: number[]): string[] {
  return slots.map((s) => {
    const mins = (s - DAY) / MIN
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`
  })
}

describe("generateSlots", () => {
  test("fills a window with back-to-back slots of the duration", () => {
    const slots = generateSlots({ windows: [win(9, 12)], booked: [], durationMs: 30 * MIN, nowMs: 0 })
    expect(slotHours(slots)).toEqual(["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"])
  })

  test("drops slots that overlap a booked consult; keeps adjacent ones", () => {
    const slots = generateSlots({
      windows: [win(9, 12)],
      booked: [{ start: at(10), end: at(10, 30) }],
      durationMs: 30 * MIN,
      nowMs: 0,
    })
    expect(slotHours(slots)).toEqual(["9:00", "9:30", "10:30", "11:00", "11:30"])
  })

  test("a slot must fit entirely within the window", () => {
    const slots = generateSlots({ windows: [win(9, 10)], booked: [], durationMs: 45 * MIN, nowMs: 0 })
    expect(slotHours(slots)).toEqual(["9:00"])
  })

  test("drops past slots", () => {
    const slots = generateSlots({ windows: [win(9, 11)], booked: [], durationMs: 30 * MIN, nowMs: at(10) })
    expect(slotHours(slots)).toEqual(["10:00", "10:30"])
  })

  test("spans multiple windows (split shift), start-ordered", () => {
    const slots = generateSlots({ windows: [win(13, 14), win(9, 10)], booked: [], durationMs: 60 * MIN, nowMs: 0 })
    expect(slotHours(slots)).toEqual(["9:00", "13:00"])
  })

  test("step smaller than duration yields overlapping start options", () => {
    const slots = generateSlots({ windows: [win(9, 11)], booked: [], durationMs: 60 * MIN, stepMs: 30 * MIN, nowMs: 0 })
    expect(slotHours(slots)).toEqual(["9:00", "9:30", "10:00"])
  })

  test("returns [] for a non-positive duration", () => {
    expect(generateSlots({ windows: [win(9, 12)], booked: [], durationMs: 0, nowMs: 0 })).toEqual([])
  })

  test("a fully-booked window yields no slots", () => {
    const slots = generateSlots({
      windows: [win(9, 10)],
      booked: [{ start: at(9), end: at(10) }],
      durationMs: 30 * MIN,
      nowMs: 0,
    })
    expect(slots).toEqual([])
  })
})
