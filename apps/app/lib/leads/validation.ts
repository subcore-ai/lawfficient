// Pure validation for the leads actions (kept out of actions.ts so it can be unit-tested).
// The DB `source` column is free text — ingestion will add sources — so LEAD_SOURCES is the
// picker vocabulary, not a hard constraint. Demographic/case fields live in `data` (see
// data-schema.ts); this validates only the lean typed core.
import type { LeadSource } from "@/data/types"

export const LEAD_SOURCES: LeadSource[] = [
  "WhatsApp",
  "Facebook",
  "Call Rails",
  "Website",
  "Referral",
  "Instagram",
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

export type LeadCoreInput = {
  firstName: string
  lastName: string
  phone: string
  email: string
  source: string
  assignedToId: string | null
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

// Required: first + last name, a source, and at least one of phone/email (a lead you can't
// reach is useless). Used for both create and edit — the edit form submits the full core.
export function parseLeadInput(raw: {
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  email?: unknown
  source?: unknown
  assignedToId?: unknown
}): { ok: true; value: LeadCoreInput } | { ok: false; error: string } {
  const firstName = str(raw.firstName)
  const lastName = str(raw.lastName)
  const phone = str(raw.phone)
  const email = str(raw.email).toLowerCase()
  const source = str(raw.source)
  const assignedToId = str(raw.assignedToId)

  if (!firstName || !lastName) return { ok: false, error: "First and last name are required." }
  if (!phone && !email) return { ok: false, error: "Add a phone number or an email." }
  if (email && !isValidEmail(email)) return { ok: false, error: "Enter a valid email address." }
  if (!source) return { ok: false, error: "Choose a source." }

  return {
    ok: true,
    value: { firstName, lastName, phone, email, source, assignedToId: assignedToId || null },
  }
}

// PARTIAL core for the API's PATCH /api/leads/{id}: only the keys PRESENT in the body are touched.
// An absent key is left unchanged (undefined in the patch); a present key is validated + trimmed. It
// guards the same invariants as parseLeadInput, but per-field: a provided name/source can't be
// blanked; a provided email must be valid; and the post-merge lead must still be reachable
// (phone OR email) — so a caller can't blank the last contact method. The post-merge reachability
// check needs the EXISTING phone/email, passed in.
export type LeadCorePatch = {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  source?: string
  assignedToId?: string | null
}

type ExistingCore = { phone: string; email: string }

export function parseLeadPatch(
  raw: Record<string, unknown>,
  existing: ExistingCore,
): { ok: true; value: LeadCorePatch } | { ok: false; error: string } {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(raw, k)
  const patch: LeadCorePatch = {}

  if (has("first_name")) {
    const v = str(raw.first_name)
    if (!v) return { ok: false, error: "First name can't be empty." }
    patch.firstName = v
  }
  if (has("last_name")) {
    const v = str(raw.last_name)
    if (!v) return { ok: false, error: "Last name can't be empty." }
    patch.lastName = v
  }
  if (has("source")) {
    const v = str(raw.source)
    if (!v) return { ok: false, error: "Source can't be empty." }
    patch.source = v
  }
  if (has("email")) {
    const v = str(raw.email).toLowerCase()
    if (v && !isValidEmail(v)) return { ok: false, error: "Enter a valid email address." }
    patch.email = v
  }
  if (has("phone")) {
    patch.phone = str(raw.phone)
  }
  // assignee_id: an explicit null (or "") unassigns; a non-empty string assigns. Its uuid shape is
  // checked at the mutation boundary (it's the assigned_to_id column), like the read API's filter.
  if (has("assignee_id")) {
    const v = raw.assignee_id
    // Only a string (assign) or null (unassign) is valid — reject other types instead of silently
    // coercing e.g. a number into an unassign.
    if (v !== null && typeof v !== "string") {
      return { ok: false, error: "assignee_id must be a string or null." }
    }
    patch.assignedToId = typeof v === "string" && v.trim() !== "" ? v.trim() : null
  }

  // The lead must still be reachable after the merge — a PATCH can't blank the LAST contact method.
  const nextPhone = patch.phone !== undefined ? patch.phone : existing.phone
  const nextEmail = patch.email !== undefined ? patch.email : existing.email
  if (!nextPhone && !nextEmail) return { ok: false, error: "Add a phone number or an email." }

  return { ok: true, value: patch }
}
