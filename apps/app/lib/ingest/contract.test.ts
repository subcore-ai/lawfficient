import { describe, expect, test } from "bun:test"

import type { LeadVocab } from "@/lib/leads/data-schema"

import { parseCanonicalPayload } from "./contract"

const VOCAB: LeadVocab = {
  caseType: ["N-400 Naturalization"],
  hierarchy: ["HRC", "NHRC"],
  qualification: ["qualified", "not_qualified", "pending"],
}

describe("parseCanonicalPayload", () => {
  test("normalizes core fields, extracts data, retains unknown keys, reads externalId", () => {
    const parsed = parseCanonicalPayload(
      {
        firstName: "  Maria ",
        lastName: "Gonzalez",
        email: "Maria@Example.COM",
        phone: "(415) 555-0123",
        externalId: "zap-9981",
        caseType: "N-400 Naturalization",
        hierarchy: "HRC",
        city: "Miami",
        utm_campaign: "spring", // unknown → extra
        lead_score: 42, // unknown non-string → extra
      },
      VOCAB
    )

    expect(parsed.core).toEqual({
      firstName: "Maria",
      lastName: "Gonzalez",
      email: "maria@example.com",
      phone: "+14155550123",
    })
    expect(parsed.externalId).toBe("zap-9981")
    expect(parsed.data.caseType).toBe("N-400 Naturalization")
    expect(parsed.data.hierarchy).toBe("HRC")
    expect(parsed.data.city).toBe("Miami")
    expect(parsed.data.zip).toBeUndefined()
    expect(parsed.extra).toEqual({ utm_campaign: "spring", lead_score: 42 })
  })

  test("missing externalId → null; unparseable phone falls back to raw", () => {
    const parsed = parseCanonicalPayload({ firstName: "A", lastName: "B", phone: "call me" }, VOCAB)
    expect(parsed.externalId).toBeNull()
    expect(parsed.core.phone).toBe("call me")
    expect(parsed.extra).toEqual({})
  })

  test("coerces numeric externalId + zip so idempotency keys survive (Zapier/CRM field maps)", () => {
    const parsed = parseCanonicalPayload(
      { firstName: "A", lastName: "B", email: "a@b.co", externalId: 12345, zip: 90210 },
      VOCAB
    )
    expect(parsed.externalId).toBe("12345")
    expect(parsed.data.zip).toBe("90210")
  })

  test("refuses an unsafe-integer externalId (>2^53) instead of coercing a precision-lost value", () => {
    const parsed = parseCanonicalPayload(
      { firstName: "A", lastName: "B", externalId: Number.MAX_SAFE_INTEGER + 2 },
      VOCAB
    )
    expect(parsed.externalId).toBeNull()
  })

  test("normalizes constrained-field casing to the firm vocabulary (hrc → HRC)", () => {
    const parsed = parseCanonicalPayload(
      { firstName: "A", lastName: "B", hierarchy: "hrc", qualification: "QUALIFIED" },
      VOCAB
    )
    expect(parsed.data.hierarchy).toBe("HRC")
    expect(parsed.data.qualification).toBe("qualified")
  })

  test("an incoming notes key is no longer a core field — it falls into extra (the timeline supersedes it)", () => {
    const parsed = parseCanonicalPayload({ firstName: "A", lastName: "B", notes: "left a voicemail" }, VOCAB)
    expect(parsed.extra).toEqual({ notes: "left a voicemail" })
  })

  test("the sender's message is a known data field (not extra), trimmed", () => {
    const parsed = parseCanonicalPayload(
      { firstName: "A", lastName: "B", message: "  my case was denied  " },
      VOCAB
    )
    expect(parsed.data.message).toBe("my case was denied")
    expect(parsed.extra).toEqual({})
  })
})
