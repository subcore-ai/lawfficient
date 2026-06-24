// Read + size-guard + JSON-parse a write request's body (spec 26, "Body limits (writes)"). Two-step
// guard, mirroring the ingestion POST: reject by the Content-Length header BEFORE buffering, then
// re-check the ACTUAL byte length after reading (Content-Length can be absent or lie). A body that's
// missing, oversized, or not a JSON object is reported as a typed failure so the route returns a clean
// 413/400 via the error envelope instead of a 500 deeper in.
import type { NextRequest } from "next/server"

// Matches the ingestion route's limit so the whole write surface shares one ceiling.
export const MAX_BODY_BYTES = 64 * 1024

export type BodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413; code: string; message: string }

export async function readJsonObject(request: NextRequest): Promise<BodyResult> {
  // Reject oversized payloads by Content-Length up front (DoS guard) — before buffering the body…
  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "payload_too_large", message: "Payload too large." }
  }
  const text = await request.text()
  // …then re-check the actual byte length (Content-Length may be absent/wrong; .length counts chars).
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "payload_too_large", message: "Payload too large." }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, status: 400, code: "invalid_json", message: "Invalid JSON body." }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400, code: "invalid_json", message: "The request body must be a JSON object." }
  }
  return { ok: true, value: parsed as Record<string, unknown> }
}
