import { describe, expect, test } from "bun:test"

import { buildLeadData, type LeadVocab, mergeLeadData, parseLeadData } from "./data-schema"

const VOCAB: LeadVocab = {
  caseType: ["VAWA (AOS)", "N-400 Naturalization"],
  hierarchy: ["HRC", "NHRC"],
  qualification: ["qualified", "not_qualified", "pending"],
}

describe("parseLeadData", () => {
  test("non-objects yield an empty object", () => {
    expect(parseLeadData(null)).toEqual({})
    expect(parseLeadData(undefined)).toEqual({})
    expect(parseLeadData("nope")).toEqual({})
    expect(parseLeadData(42)).toEqual({})
    expect(parseLeadData([1, 2])).toEqual({})
  })

  test("keeps stored known fields", () => {
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

  test("lenient on constrained fields (firm-defined / historical labels still render); drops non-strings, blanks, unknown keys; trims", () => {
    expect(
      parseLeadData({
        caseType: "Asylum", // firm-defined value not in any hard-coded list — kept
        hierarchy: " HRC ", // trimmed
        qualification: "needs_review", // custom — kept
        city: "  ", // blank → dropped
        gender: 5, // non-string → dropped
        rawPayload: { a: 1 }, // unknown key — stays in the column, not surfaced
        preferredLanguage: " Spanish ",
      })
    ).toEqual({
      caseType: "Asylum",
      hierarchy: "HRC",
      qualification: "needs_review",
      preferredLanguage: "Spanish",
    })
  })

  test("surfaces the sender's message (free-text), trimmed", () => {
    expect(parseLeadData({ message: "  my case was denied  " })).toEqual({ message: "my case was denied" })
  })
})

describe("buildLeadData", () => {
  test("assembles a clean payload, trimming + dropping empties", () => {
    expect(buildLeadData({ caseType: "VAWA (AOS)", city: " Miami ", state: "", zip: "33101" }, VOCAB)).toEqual({
      ok: true,
      value: { caseType: "VAWA (AOS)", city: "Miami", zip: "33101" },
    })
  })

  test("empty input is valid (an empty payload)", () => {
    expect(buildLeadData({}, VOCAB)).toEqual({ ok: true, value: {} })
  })

  test("keeps the message (free-text), trimmed", () => {
    expect(buildLeadData({ message: " their words " }, VOCAB)).toEqual({ ok: true, value: { message: "their words" } })
  })

  test("rejects values outside the firm's vocabulary", () => {
    expect(buildLeadData({ caseType: "Nope" }, VOCAB)).toEqual({ ok: false, error: "Invalid case type." })
    expect(buildLeadData({ hierarchy: "X" }, VOCAB)).toEqual({ ok: false, error: "Invalid hierarchy." })
    expect(buildLeadData({ qualification: "maybe" }, VOCAB)).toEqual({ ok: false, error: "Invalid qualification." })
  })

  test("accepts a firm-defined custom value present in the vocab", () => {
    const vocab: LeadVocab = { ...VOCAB, caseType: ["Asylum"] }
    expect(buildLeadData({ caseType: "Asylum" }, vocab)).toEqual({ ok: true, value: { caseType: "Asylum" } })
  })
})

describe("mergeLeadData", () => {
  test("replaces form-managed keys, drops cleared ones, preserves unknown keys", () => {
    const existing = { caseType: "VAWA (AOS)", city: "Miami", rawPayload: { utm: "fb" }, externalId: "x1" }
    const merged = mergeLeadData(existing, { caseType: "N-400 Naturalization", state: "FL" })
    expect(merged).toEqual({
      caseType: "N-400 Naturalization",
      state: "FL",
      rawPayload: { utm: "fb" },
      externalId: "x1",
    })
  })

  test("tolerates null / non-object existing data", () => {
    expect(mergeLeadData(null, { city: "Miami" })).toEqual({ city: "Miami" })
    expect(mergeLeadData("nope", { city: "Miami" })).toEqual({ city: "Miami" })
  })
})
