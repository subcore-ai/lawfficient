// Pure, dependency-free validation for the user-management actions. Kept separate
// from actions.ts (which is "use server" + DB) so it can be unit-tested directly.
import type { Role } from "@/data/types"
import { isValidEmail } from "@/lib/validation"

export const STAFF_ROLES: Role[] = [
  "admin",
  "attorney",
  "la_lead",
  "legal_assistant",
  "qa_lead",
  "creative_writer",
  "sales",
  "accounts_receivable",
  "file_clerk",
]

export function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value)
    ? (value as Role)
    : null
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export type InviteInput = { name: string; email: string; role: Role }

export function parseInviteInput(raw: {
  name?: unknown
  email?: unknown
  role?: unknown
}): { ok: true; value: InviteInput } | { ok: false; error: string } {
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const email = normalizeEmail(raw.email)
  const role = parseRole(raw.role)
  if (!name) return { ok: false, error: "Name is required." }
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." }
  if (!role) return { ok: false, error: "Choose a valid role." }
  return { ok: true, value: { name, email, role } }
}
