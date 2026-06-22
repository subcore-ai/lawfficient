import { describe, expect, test } from "bun:test"

import { parseCanonicalPayload } from "./contract"

describe("parseCanonicalPayload", () => {
  test("normalizes core fields, extracts data, retains unknown keys, reads externalId", () => {
    const parsed = parseCanonicalPayload({
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
    })

    expect(parsed.core).toEqual({
      firstName: "Maria",
      lastName: "Gonzalez",
      email: "maria@example.com",
      phone: "+14155550123",
      notes: "",
    })
    expect(parsed.externalId).toBe("zap-9981")
    expect(parsed.data.caseType).toBe("N-400 Naturalization")
    expect(parsed.data.hierarchy).toBe("HRC")
    expect(parsed.data.city).toBe("Miami")
    expect(parsed.data.zip).toBeUndefined()
    expect(parsed.extra).toEqual({ utm_campaign: "spring", lead_score: 42 })
  })

  test("missing externalId → null; unparseable phone falls back to raw", () => {
    const parsed = parseCanonicalPayload({ firstName: "A", lastName: "B", phone: "call me" })
    expect(parsed.externalId).toBeNull()
    expect(parsed.core.phone).toBe("call me")
    expect(parsed.extra).toEqual({})
  })

  test("coerces numeric externalId + zip so idempotency keys survive (Zapier/CRM field maps)", () => {
    const parsed = parseCanonicalPayload({ firstName: "A", lastName: "B", email: "a@b.co", externalId: 12345, zip: 90210 })
    expect(parsed.externalId).toBe("12345")
    expect(parsed.data.zip).toBe("90210")
  })
})
