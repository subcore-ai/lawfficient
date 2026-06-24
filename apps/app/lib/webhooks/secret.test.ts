import { describe, expect, test } from "bun:test"

import { hashKey } from "@/lib/ingest/keys"
import { generateSecret, signPayload, SIGNATURE_HEADER, verifySignature } from "./secret"

describe("generateSecret", () => {
  test("returns a prefixed raw secret with a matching hash + last4", () => {
    const s = generateSecret()
    expect(s.raw.startsWith("whsec_")).toBe(true)
    expect(s.hash).toBe(hashKey(s.raw))
    expect(s.last4).toBe(s.raw.slice(-4))
    expect(s.last4.length).toBe(4)
  })

  test("is unique per call", () => {
    expect(generateSecret().raw).not.toBe(generateSecret().raw)
  })
})

describe("signPayload", () => {
  const secret = "whsec_test_secret"
  const body = JSON.stringify({ id: "evt_1", type: "lead.created" })

  test("produces the t=…,v1=… header shape", () => {
    const header = signPayload(secret, body, 1_700_000_000)
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/)
  })

  test("is deterministic for the same (secret, body, timestamp)", () => {
    expect(signPayload(secret, body, 1_700_000_000)).toBe(signPayload(secret, body, 1_700_000_000))
  })

  test("changes when the timestamp changes (timestamp is in the signed material)", () => {
    expect(signPayload(secret, body, 1_700_000_000)).not.toBe(signPayload(secret, body, 1_700_000_001))
  })

  test("changes when the body changes", () => {
    expect(signPayload(secret, body, 1_700_000_000)).not.toBe(signPayload(secret, body + " ", 1_700_000_000))
  })

  test("changes when the secret changes", () => {
    expect(signPayload(secret, body, 1_700_000_000)).not.toBe(signPayload(secret + "x", body, 1_700_000_000))
  })
})

describe("verifySignature (round-trip)", () => {
  const secret = "whsec_roundtrip"
  const body = JSON.stringify({ id: "evt_2", type: "lead.updated", data: { a: 1 } })
  const now = 1_700_000_000

  test("accepts a signature it just produced", () => {
    const header = signPayload(secret, body, now)
    expect(verifySignature(secret, body, header, now)).toBe(true)
  })

  test("rejects a wrong secret", () => {
    const header = signPayload(secret, body, now)
    expect(verifySignature("whsec_other", body, header, now)).toBe(false)
  })

  test("rejects a tampered body", () => {
    const header = signPayload(secret, body, now)
    expect(verifySignature(secret, body + "tamper", header, now)).toBe(false)
  })

  test("rejects a stale timestamp beyond tolerance", () => {
    const header = signPayload(secret, body, now)
    // 10 minutes later, default tolerance 5 minutes.
    expect(verifySignature(secret, body, header, now + 600)).toBe(false)
  })

  test("accepts within tolerance", () => {
    const header = signPayload(secret, body, now)
    expect(verifySignature(secret, body, header, now + 60)).toBe(true)
  })

  test("rejects a malformed header", () => {
    expect(verifySignature(secret, body, "not-a-signature", now)).toBe(false)
    expect(verifySignature(secret, body, "t=abc,v1=", now)).toBe(false)
  })

  test("returns false (never throws) for a multi-byte v1 of matching string length", () => {
    // 64 'é' = a 64-char string (matches a hex digest's length) but 128 UTF-8 bytes — the byte-length
    // guard must catch this so timingSafeEqual never throws on unequal-length buffers.
    const header = `t=${now},v1=${"é".repeat(64)}`
    expect(verifySignature(secret, body, header, now)).toBe(false)
  })
})

describe("SIGNATURE_HEADER", () => {
  test("is the spec-27 header name", () => {
    expect(SIGNATURE_HEADER).toBe("Lawfficient-Signature")
  })
})
