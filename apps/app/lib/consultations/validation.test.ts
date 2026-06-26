import { describe, expect, test } from "bun:test"

import { CONSULTATION_STATUSES, parseConsultationInput, parseConsultationPatch } from "./validation"

const VALID = {
  leadId: "lead-1",
  attorneyId: "att-1",
  type: "Initial consultation",
  startAt: "2026-07-01T15:00:00.000Z",
  durationMin: 30,
  timeZone: "America/New_York",
  paid: true,
  amount: 150,
}

describe("parseConsultationInput", () => {
  test("a valid booking parses + trims", () => {
    const res = parseConsultationInput({ ...VALID, type: "  Case review  " })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value).toMatchObject({ leadId: "lead-1", type: "Case review", durationMin: 30, paid: true, amount: 150 })
  })

  test("requires a lead", () => {
    expect(parseConsultationInput({ ...VALID, leadId: "" })).toMatchObject({ ok: false })
    expect(parseConsultationInput({ ...VALID, leadId: 123 })).toMatchObject({ ok: false })
  })

  test("requires a type", () => {
    expect(parseConsultationInput({ ...VALID, type: "   " })).toMatchObject({ ok: false })
  })

  test("rejects an invalid start time", () => {
    expect(parseConsultationInput({ ...VALID, startAt: "not-a-date" })).toMatchObject({ ok: false })
    expect(parseConsultationInput({ ...VALID, startAt: "" })).toMatchObject({ ok: false })
  })

  test("duration must be a positive integer", () => {
    expect(parseConsultationInput({ ...VALID, durationMin: 0 })).toMatchObject({ ok: false })
    expect(parseConsultationInput({ ...VALID, durationMin: -15 })).toMatchObject({ ok: false })
    expect(parseConsultationInput({ ...VALID, durationMin: 45 })).toMatchObject({ ok: true })
  })

  test("attorney is optional: null/absent → null, a string passes, a non-string is rejected", () => {
    expect(parseConsultationInput({ ...VALID, attorneyId: null })).toMatchObject({ ok: true, value: { attorneyId: null } })
    expect(parseConsultationInput({ ...VALID, attorneyId: "" })).toMatchObject({ ok: true, value: { attorneyId: null } })
    expect(parseConsultationInput({ ...VALID, attorneyId: 7 })).toMatchObject({ ok: false })
  })

  test("amount: optional, non-negative; bad values rejected", () => {
    expect(parseConsultationInput({ ...VALID, amount: null })).toMatchObject({ ok: true, value: { amount: null } })
    expect(parseConsultationInput({ ...VALID, amount: "" })).toMatchObject({ ok: true, value: { amount: null } })
    expect(parseConsultationInput({ ...VALID, amount: "200" })).toMatchObject({ ok: true, value: { amount: 200 } })
    expect(parseConsultationInput({ ...VALID, amount: -5 })).toMatchObject({ ok: false })
    expect(parseConsultationInput({ ...VALID, amount: "abc" })).toMatchObject({ ok: false })
  })

  test("paid coerces from form-ish values", () => {
    expect(parseConsultationInput({ ...VALID, paid: "on" })).toMatchObject({ ok: true, value: { paid: true } })
    expect(parseConsultationInput({ ...VALID, paid: false })).toMatchObject({ ok: true, value: { paid: false } })
    expect(parseConsultationInput({ ...VALID, paid: undefined })).toMatchObject({ ok: true, value: { paid: false } })
  })
})

describe("parseConsultationPatch", () => {
  test("an empty patch is ok (no-op)", () => {
    expect(parseConsultationPatch({})).toEqual({ ok: true, value: {} })
  })

  test("only present keys are touched", () => {
    const res = parseConsultationPatch({ status: "completed", outcome: "qualified" })
    expect(res).toEqual({ ok: true, value: { status: "completed", outcome: "qualified" } })
  })

  test("a provided type/start can't be blanked or invalid", () => {
    expect(parseConsultationPatch({ type: "  " })).toMatchObject({ ok: false })
    expect(parseConsultationPatch({ startAt: "nope" })).toMatchObject({ ok: false })
  })

  test("status must be a known lifecycle value", () => {
    for (const s of CONSULTATION_STATUSES) expect(parseConsultationPatch({ status: s })).toMatchObject({ ok: true })
    expect(parseConsultationPatch({ status: "bogus" })).toMatchObject({ ok: false })
  })

  test("outcome can be set or cleared (null); a non-string is rejected", () => {
    expect(parseConsultationPatch({ outcome: null })).toEqual({ ok: true, value: { outcome: null } })
    expect(parseConsultationPatch({ outcome: "not qualified" })).toEqual({ ok: true, value: { outcome: "not qualified" } })
    expect(parseConsultationPatch({ outcome: 3 })).toMatchObject({ ok: false })
  })

  test("attorney null unassigns; a non-string is rejected", () => {
    expect(parseConsultationPatch({ attorneyId: null })).toEqual({ ok: true, value: { attorneyId: null } })
    expect(parseConsultationPatch({ attorneyId: 9 })).toMatchObject({ ok: false })
  })
})
