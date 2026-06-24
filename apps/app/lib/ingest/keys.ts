// Opaque API key: a prefix + 256 bits of randomness (base64url). The raw key is shown to the admin
// exactly once at creation; only its sha256 hash + last4 are stored. The request path hashes the
// incoming raw key and looks it up by hash — so a DB leak never yields a usable key, and the stored
// hash can't be used to authenticate. Default prefix `lfk_` for per-source ingestion keys (0021);
// public-API keys (0034) pass `lak_` so the two are distinguishable at a glance.
import { createHash, randomBytes } from "node:crypto"

export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex")
}

export function generateKey(prefix = "lfk_"): { raw: string; hash: string; last4: string } {
  const raw = prefix + randomBytes(32).toString("base64url")
  return { raw, hash: hashKey(raw), last4: raw.slice(-4) }
}
