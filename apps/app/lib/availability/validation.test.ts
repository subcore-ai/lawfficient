import { describe, expect, test } from "bun:test"

import { timeToMinutes, validateWindows } from "./validation"

describe("timeToMinutes", () => {
  test("parses HH:MM and HH:MM:SS", () => {
    expect(timeToMinutes("09:00")).toBe(540)
    expect(timeToMinutes("13:30:00")).toBe(810)
    expect(timeToMinutes("00:00")).toBe(0)
  })

  test("rejects malformed or out-of-range times", () => {
    expect(timeToMinutes("9:00")).toBeNull()
    expect(timeToMinutes("24:00")).toBeNull()
    expect(timeToMinutes("10:60")).toBeNull()
    expect(timeToMinutes("noon")).toBeNull()
  })

  test("accepts :00 seconds but rejects non-zero seconds (minute precision)", () => {
    expect(timeToMinutes("09:00:00")).toBe(540)
    expect(timeToMinutes("09:00:30")).toBeNull()
    expect(timeToMinutes("09:00:99")).toBeNull()
  })
})

describe("validateWindows", () => {
  test("accepts well-formed, non-overlapping windows", () => {
    const r = validateWindows([
      { weekday: 1, startTime: "09:00", endTime: "12:00" },
      { weekday: 1, startTime: "13:00", endTime: "17:00" },
      { weekday: 2, startTime: "09:00", endTime: "17:00" },
    ])
    expect(r.ok).toBe(true)
  })

  test("normalizes HH:MM:SS to HH:MM in the returned value", () => {
    const r = validateWindows([{ weekday: 0, startTime: "09:00:00", endTime: "17:00:00" }])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value[0]).toEqual({ weekday: 0, startTime: "09:00", endTime: "17:00" })
  })

  test("rejects start >= end", () => {
    const r = validateWindows([{ weekday: 1, startTime: "17:00", endTime: "09:00" }])
    expect(r).toEqual({ ok: false, error: "Start time must be before end time." })
  })

  test("rejects overlapping windows within a day", () => {
    const r = validateWindows([
      { weekday: 1, startTime: "09:00", endTime: "13:00" },
      { weekday: 1, startTime: "12:00", endTime: "17:00" },
    ])
    expect(r.ok).toBe(false)
  })

  test("allows adjacent windows (end == next start)", () => {
    const r = validateWindows([
      { weekday: 1, startTime: "09:00", endTime: "12:00" },
      { weekday: 1, startTime: "12:00", endTime: "17:00" },
    ])
    expect(r.ok).toBe(true)
  })

  test("same times on different days do not overlap", () => {
    const r = validateWindows([
      { weekday: 1, startTime: "09:00", endTime: "17:00" },
      { weekday: 2, startTime: "09:00", endTime: "17:00" },
    ])
    expect(r.ok).toBe(true)
  })

  test("rejects an invalid weekday", () => {
    const r = validateWindows([{ weekday: 7, startTime: "09:00", endTime: "17:00" }])
    expect(r.ok).toBe(false)
  })

  test("rejects malformed payloads instead of throwing", () => {
    expect(validateWindows(null).ok).toBe(false)
    expect(validateWindows("nope").ok).toBe(false)
    expect(validateWindows({ weekday: 1 }).ok).toBe(false)
    expect(validateWindows([null]).ok).toBe(false)
    expect(validateWindows([{ weekday: 1 }]).ok).toBe(false)
    expect(validateWindows([{ weekday: 1, startTime: 9, endTime: 17 }]).ok).toBe(false)
  })
})
