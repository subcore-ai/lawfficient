// Per-key rate limiting for the read API (spec 26: per firm/key, 429 + Retry-After).
//
// The ingestion limiter counts rows in the webhook_events log over a trailing window — but the
// read API writes no such log, and inserting a metering row per GET would be a needless write on
// every read. So this is a lightweight in-memory sliding-window counter keyed by API key id.
// Caveat (documented, acceptable for Phase 1): serverless instances don't share memory, so the
// effective limit is per-instance — a coarse abuse guard, not a precise quota. A shared/durable
// limiter (Postgres counter or KV) can replace this later without touching call sites.
//
// Pure + injectable: the store and clock are parameters so the window logic is unit-tested
// deterministically.
export const RATE_LIMIT = 120 // requests
export const RATE_WINDOW_SECONDS = 60

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number }

type Bucket = number[] // request timestamps (ms), oldest first
export type RateLimitStore = Map<string, Bucket>

// Record one hit for `key` and report whether it's within `limit` over the trailing
// `windowSeconds`. Evicts timestamps outside the window first, so the store self-trims.
export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  now: number,
  limit: number = RATE_LIMIT,
  windowSeconds: number = RATE_WINDOW_SECONDS,
): RateLimitResult {
  const windowMs = windowSeconds * 1000
  const cutoff = now - windowMs
  const recent = (store.get(key) ?? []).filter((t) => t > cutoff)

  if (recent.length >= limit) {
    store.set(key, recent)
    // Retry once the oldest in-window hit ages out (ceil to whole seconds, min 1).
    const oldest = recent[0] ?? now
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  recent.push(now)
  store.set(key, recent)
  return { ok: true }
}

// Process-wide store for the route handlers (one bucket per key id).
const globalStore: RateLimitStore = new Map()

// Drop buckets whose newest hit has already aged out of the window. Without this the process-wide
// store would retain a bucket per key id forever (a slow leak); sweeping reclaims them with no
// background timer. Pure + exported so the eviction is unit-tested deterministically.
export function sweepExpired(
  store: RateLimitStore,
  now: number,
  windowSeconds: number = RATE_WINDOW_SECONDS,
): void {
  const cutoff = now - windowSeconds * 1000
  for (const [key, bucket] of store) {
    const newest = bucket[bucket.length - 1]
    if (newest === undefined || newest <= cutoff) store.delete(key)
  }
}

export function rateLimitByKey(keyId: string): RateLimitResult {
  const now = Date.now()
  // ~1% of calls sweep expired buckets — amortized cleanup, no timer, negligible per-request cost.
  if (Math.random() < 0.01) sweepExpired(globalStore, now)
  return checkRateLimit(globalStore, keyId, now)
}
