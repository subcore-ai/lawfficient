import { describe, expect, test } from "bun:test"

import { jsonRecord } from "./json"

describe("jsonRecord", () => {
  test("returns a plain object unchanged (same reference)", () => {
    const obj = { a: 1, b: "x" }
    expect(jsonRecord(obj)).toBe(obj)
  })

  test("coerces non-objects to {}", () => {
    expect(jsonRecord(null)).toEqual({})
    expect(jsonRecord(undefined)).toEqual({})
    expect(jsonRecord("str")).toEqual({})
    expect(jsonRecord(42)).toEqual({})
    expect(jsonRecord(true)).toEqual({})
    expect(jsonRecord([1, 2, 3])).toEqual({})
  })
})
