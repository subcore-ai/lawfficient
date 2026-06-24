// Endpoint signing secret + payload signature (spec 27).
//
// The secret is opaque (`whsec_` + 256 bits, base64url) and shown to the admin ONCE at creation;
// only its sha256 hash (+ last4) is stored — same model as the ingestion key (lib/ingest/keys),
// whose hashKey we reuse so a DB leak never yields a usable secret.
//
// Each delivery is signed with `Lawfficient-Signature: t=<unix>,v1=<hex>` where the HMAC-SHA256 is
// computed over `<t>.<rawBody>` (the timestamp is folded into the signed material so it can't be
// altered, and bounds replay). Consumers recompute the HMAC with their stored secret and reject a
// mismatch or a stale timestamp. Stripe-style, the common convention.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { hashKey } from "@/lib/ingest/keys"

const SECRET_PREFIX = "whsec_"

export const SIGNATURE_HEADER = "Lawfficient-Signature"

// A new signing secret: the raw value (shown once) + its stored hash + last4 for display.
export function generateSecret(): { raw: string; hash: string; last4: string } {
  const raw = SECRET_PREFIX + randomBytes(32).toString("base64url")
  return { raw, hash: hashKey(raw), last4: raw.slice(-4) }
}

// The signed material: the timestamp and the raw body, joined by a dot, so the timestamp is covered
// by the signature.
function signedPayload(timestamp: number, body: string): string {
  return `${timestamp}.${body}`
}

// The `Lawfficient-Signature` header value for a body at a given unix-second timestamp. Pure +
// deterministic given (secret, body, timestamp) → unit-testable.
export function signPayload(secret: string, body: string, timestamp: number): string {
  const mac = createHmac("sha256", secret).update(signedPayload(timestamp, body)).digest("hex")
  return `t=${timestamp},v1=${mac}`
}

// Verify a header against a body + secret, rejecting a timestamp older than `toleranceSeconds`
// (replay bound). Not used by the emitter (the platform signs, consumers verify) — exported so the
// signing scheme is round-trip tested, and as the reference a consumer mirrors.
export function verifySignature(
  secret: string,
  body: string,
  header: string,
  now: number,
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=")
      return [k?.trim() ?? "", v?.trim() ?? ""]
    }),
  )
  const t = Number(parts.t)
  const v1 = parts.v1
  if (!Number.isFinite(t) || !v1) return false
  if (Math.abs(now - t) > toleranceSeconds) return false

  const expected = createHmac("sha256", secret).update(signedPayload(t, body)).digest("hex")
  // Constant-time compare. Build the buffers first and compare BYTE lengths — a v1 carrying
  // multi-byte chars has a UTF-8 byte length ≠ its string length, which would make timingSafeEqual
  // throw on unequal buffers instead of returning a clean false.
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(v1)
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}
