// Shared, dependency-free validation primitives used across the domain validators
// (leads, users, …). Pragmatic shape check — the real validators (Supabase Auth,
// the DB) do the authoritative work; this just catches obvious mistakes early.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}
