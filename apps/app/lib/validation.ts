// Shared, dependency-free validation primitives used across the domain validators
// (leads, users, …). Pragmatic shape check — the real validators (Supabase Auth,
// the DB) do the authoritative work; this just catches obvious mistakes early.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

// Coerce an unknown form/JSON value to a trimmed string, or "" when it isn't a string. The single
// front-door for parsing user-supplied text fields across the domain validators. (The ingest
// contract has its own variant that additionally coerces numbers — see lib/ingest/contract.ts.)
export function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
