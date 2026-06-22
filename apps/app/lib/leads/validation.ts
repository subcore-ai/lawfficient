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
