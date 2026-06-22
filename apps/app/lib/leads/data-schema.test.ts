import { describe, expect, test } from "bun:test"

import { buildLeadData, parseLeadData } from "./data-schema"

describe("parseLeadData", () => {
  test("non-objects yield an empty object", () => {
    expect(parseLeadData(null)).toEqual({})
    expect(parseLeadData(undefined)).toEqual({})
    expect(parseLeadData("nope")).toEqual({})
    expect(parseLeadData(42)).toEqual({})
    expect(parseLeadData([1, 2])).toEqual({})
  })

  test("keeps valid known fields", () => {
    expect(
      parseLeadData({
        caseType: "N-400 Naturalization",
        hierarchy: "HRC",
        qualification: "qualified",
        city: "Miami",
        zip: "33101",
      })
    ).toEqual({
      caseType: "N-400 Naturalization",
      hierarchy: "HRC",
      qualification: "qualified",
      city: "Miami",
      zip: "33101",
    })
  })

  test("drops invalid vocab, non-strings, blanks, and unknown keys; trims", () => {
    expect(
      parseLeadData({
        caseType: "Made Up", // not in CASE_TYPES
        hierarchy: "MID", // invalid
        qualification: "maybe", // invalid
        city: "  ", // blank
        gender: 5, // non-string
        rawPayload: { a: 1 }, // unknown key — stays in the column, not surfaced
        preferredLanguage: " Spanish ",
      })
    ).toEqual({ preferredLanguage: "Spanish" })
  })
})

describe("buildLeadData", () => {
  test("assembles a clean payload, trimming + dropping empties", () => {
    expect(buildLeadData({ caseType: "VAWA (AOS)", city: " Miami ", state: "", zip: "33101" })).toEqual({
      ok: true,
      value: { caseType: "VAWA (AOS)", city: "Miami", zip: "33101" },
    })
  })

  test("empty input is valid (an empty payload)", () => {
    expect(buildLeadData({})).toEqual({ ok: true, value: {} })
  })

  test("rejects invalid constrained values", () => {
    expect(buildLeadData({ caseType: "Nope" })).toEqual({ ok: false, error: "Invalid case type." })
    expect(buildLeadData({ hierarchy: "X" })).toEqual({ ok: false, error: "Invalid hierarchy." })
    expect(buildLeadData({ qualification: "maybe" })).toEqual({ ok: false, error: "Invalid qualification." })
  })
})
