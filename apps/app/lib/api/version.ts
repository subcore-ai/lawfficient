// API versioning is requested via a header, never the path (spec 26): the path stays stable
// (`/api/leads`) and a date-stamped `Lawfficient-Version` selects the version, Stripe-style.
// Absent → the latest stable version. Responses echo the resolved version so callers can see
// what they got. Breaking changes will mint a new dated version and handlers will branch on it;
// for now v1 is the implicit default and this just normalizes + echoes.
export const VERSION_HEADER = "Lawfficient-Version"

// The latest stable API version (ISO date). Bump when a new dated version ships.
export const LATEST_VERSION = "2026-07-01"

// Resolve the requested version from the request headers, defaulting to LATEST_VERSION when the
// header is missing or blank. Today any value resolves to itself (single version); future
// versions will validate against a known set here.
export function resolveVersion(headers: Headers): string {
  const requested = headers.get(VERSION_HEADER)?.trim()
  return requested ? requested : LATEST_VERSION
}

// Echo the resolved version back on a response. Mutates + returns the same response so calls
// chain (`return withVersion(apiJson(...), version)`).
export function withVersion<T extends Response>(response: T, version: string): T {
  response.headers.set(VERSION_HEADER, version)
  return response
}
