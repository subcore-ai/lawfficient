// The standard result shape for a mutating server action: `{ ok: true }` on success, or
// `{ error }` with a user-facing message on failure. Client callers narrow on `"error" in res`
// to toast the message; a success carries no payload. Actions that return extra data on success
// (e.g. a generated key or id) widen this locally instead of using it.
export type ActionResult = { ok: true } | { error: string }
