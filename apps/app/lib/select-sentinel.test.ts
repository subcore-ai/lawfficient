import { describe, expect, test } from "bun:test"

import { NONE, noneToEmpty, noneToNull, personOptions } from "./select-sentinel"

describe("NONE", () => {
  test("keeps the reserved prefix that makes it collision-proof", () => {
    expect(NONE.startsWith("__")).toBe(true)
  })
})

describe("personOptions", () => {
  test("puts Unassigned first, then each person by id", () => {
    expect(
      personOptions([
        { id: "a1", name: "Ada" },
        { id: "b2", name: "Bo" },
      ]),
    ).toEqual([
      { value: NONE, label: "Unassigned" },
      { value: "a1", label: "Ada" },
      { value: "b2", label: "Bo" },
    ])
  })

  test("still offers Unassigned with no people", () => {
    expect(personOptions([])).toEqual([{ value: NONE, label: "Unassigned" }])
  })
})

describe("noneToEmpty", () => {
  test("maps the sentinel to the cleared value and passes ids through", () => {
    expect(noneToEmpty(NONE)).toBe("")
    expect(noneToEmpty("a1")).toBe("a1")
    expect(noneToEmpty("")).toBe("")
  })
})

describe("noneToNull", () => {
  test("maps the sentinel to null and passes ids through", () => {
    expect(noneToNull(NONE)).toBeNull()
    expect(noneToNull("a1")).toBe("a1")
  })
})
