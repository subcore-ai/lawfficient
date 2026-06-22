// Opaque per-source API key: an `lfk_` prefix + 256 bits of randomness (base64url). The raw
// key is shown to the admin exactly once at creation; only its sha256 hash + last4 are stored.
// The ingest endpoint hashes the incoming raw key and looks it up by hash — so a DB leak never
// yields a usable key, and the stored hash can't be used to authenticate.
import { createHash, randomBytes } from "node:crypto"

const PREFIX = "lfk_"

export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex")
}

export function generateKey(): { raw: string; hash: string; last4: string } {
  const raw = PREFIX + randomBytes(32).toString("base64url")
  return { raw, hash: hashKey(raw), last4: raw.slice(-4) }
}
