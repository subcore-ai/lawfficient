import { describe, expect, test } from "bun:test"
import type { NextRequest } from "next/server"

import { MAX_BODY_BYTES, readJsonObject } from "./body"

// A minimal NextRequest stand-in: just the headers + a text() body, which is all readJsonObject uses.
function reqWith(body: string, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers(headers),
    text: () => Promise.resolve(body),
  } as unknown as NextRequest
}

describe("readJsonObject", () => {
  test("parses a JSON object", async () => {
    const r = await readJsonObject(reqWith(JSON.stringify({ a: 1 })))
    expect(r).toEqual({ ok: true, value: { a: 1 } })
  })

  test("rejects oversized payloads by Content-Length BEFORE reading → 413", async () => {
    const r = await readJsonObject(reqWith("{}", { "content-length": String(MAX_BODY_BYTES + 1) }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect([r.status, r.code]).toEqual([413, "payload_too_large"])
  })

  test("rejects an oversized ACTUAL body even when Content-Length lies → 413", async () => {
    const big = JSON.stringify({ x: "a".repeat(MAX_BODY_BYTES) })
    // Content-Length absent/wrong, but the real byte length is over the cap.
    const r = await readJsonObject(reqWith(big))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(413)
  })

  test("invalid JSON → 400 invalid_json", async () => {
    const r = await readJsonObject(reqWith("not json"))
    expect(r.ok).toBe(false)
    if (!r.ok) expect([r.status, r.code]).toEqual([400, "invalid_json"])
  })

  test("a JSON array or scalar is not an object → 400", async () => {
    for (const body of ["[1,2]", "42", '"str"', "null"]) {
      const r = await readJsonObject(reqWith(body))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.status).toBe(400)
    }
  })
})
