// Pure validation for the consultations actions (kept out of actions.ts so it can be unit-tested),
// mirroring lib/leads/validation.ts. A consultation attaches to a LEAD (the contact); `type` is free
// text (firm-pickable in the UI, taxonomy-upgradeable later); `data` (jsonb) holds practice-specific
// fields. Status is a fixed, universal booking lifecycle.
import type { Database } from "@/lib/supabase/database.types"
import { isValidTimeZone } from "./time"

export type ConsultationStatus = Database["public"]["Enums"]["consultation_status"]
export const CONSULTATION_STATUSES: ConsultationStatus[] = [
  "scheduled",
  "paid",
  "completed",
  "rescheduled",
  "canceled",
  "no_show",
]

// Default picker for the booking form until a firm defines its own consultation types. Free text in
// the DB, so a firm can use anything; these are just sensible, practice-agnostic defaults.
export const DEFAULT_CONSULTATION_TYPES = ["Initial consultation", "Case review", "Follow-up"]

export type ConsultationCoreInput = {
  leadId: string
  attorneyId: string | null
  type: string
  startAt: string // ISO 8601
  durationMin: number
  timeZone: string
  paid: boolean
  amount: number | null
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

// Amount is optional; when present it must be a non-negative number. Returns the parsed value or an
// error string. (Payment is track-only in v1 — we store the figure, we don't charge a card.)
function parseAmount(value: unknown): { ok: true; amount: number | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, amount: null }
  const n = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Amount must be a non-negative number." }
  return { ok: true, amount: n }
}

// Required: a lead, a type, a valid start time, a positive duration. Used for booking.
export function parseConsultationInput(raw: {
  leadId?: unknown
  attorneyId?: unknown
  type?: unknown
  startAt?: unknown
  durationMin?: unknown
  timeZone?: unknown
  paid?: unknown
  amount?: unknown
}): { ok: true; value: ConsultationCoreInput } | { ok: false; error: string } {
  const leadId = str(raw.leadId)
  if (!leadId) return { ok: false, error: "Pick the lead this consultation is for." }

  const type = str(raw.type)
  if (!type) return { ok: false, error: "Choose a consultation type." }

  const startAt = str(raw.startAt)
  if (!startAt || Number.isNaN(Date.parse(startAt))) return { ok: false, error: "Choose a valid date and time." }

  const durationMin = typeof raw.durationMin === "number" ? raw.durationMin : Number(str(raw.durationMin))
  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    return { ok: false, error: "Duration must be a positive number of minutes." }
  }

  // assignee/attorney: a non-string (e.g. a number) would str()→"" and silently drop — reject it.
  if (raw.attorneyId != null && typeof raw.attorneyId !== "string") {
    return { ok: false, error: "attorney_id must be a string or null." }
  }
  const attorneyId = str(raw.attorneyId) || null

  const paid = raw.paid === true || raw.paid === "true" || raw.paid === "on"
  const amount = parseAmount(raw.amount)
  if (!amount.ok) return amount

  const timeZone = str(raw.timeZone) || "America/New_York"
  if (!isValidTimeZone(timeZone)) return { ok: false, error: "Choose a valid time zone." }

  return { ok: true, value: { leadId, attorneyId, type, startAt, durationMin, timeZone, paid, amount: amount.amount } }
}

export type ConsultationPatch = {
  attorneyId?: string | null
  type?: string
  startAt?: string
  durationMin?: number
  timeZone?: string
  paid?: boolean
  amount?: number | null
  status?: ConsultationStatus
  outcome?: string | null
}

// PARTIAL update: only the keys PRESENT are touched. A provided type/startAt/duration can't be blanked
// or made invalid; status must be one of the lifecycle values; outcome can be set or cleared (null).
export function parseConsultationPatch(
  raw: Record<string, unknown>,
): { ok: true; value: ConsultationPatch } | { ok: false; error: string } {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(raw, k)
  const patch: ConsultationPatch = {}

  if (has("type")) {
    const v = str(raw.type)
    if (!v) return { ok: false, error: "Consultation type can't be empty." }
    patch.type = v
  }
  if (has("startAt")) {
    const v = str(raw.startAt)
    if (!v || Number.isNaN(Date.parse(v))) return { ok: false, error: "Choose a valid date and time." }
    patch.startAt = v
  }
  if (has("durationMin")) {
    const v = typeof raw.durationMin === "number" ? raw.durationMin : Number(str(raw.durationMin))
    if (!Number.isInteger(v) || v <= 0) return { ok: false, error: "Duration must be a positive number of minutes." }
    patch.durationMin = v
  }
  if (has("timeZone")) {
    const v = str(raw.timeZone)
    if (!v) return { ok: false, error: "Time zone can't be empty." }
    if (!isValidTimeZone(v)) return { ok: false, error: "Choose a valid time zone." }
    patch.timeZone = v
  }
  if (has("attorneyId")) {
    if (raw.attorneyId !== null && typeof raw.attorneyId !== "string") {
      return { ok: false, error: "attorney_id must be a string or null." }
    }
    patch.attorneyId = str(raw.attorneyId) || null
  }
  if (has("paid")) patch.paid = raw.paid === true || raw.paid === "true" || raw.paid === "on"
  if (has("amount")) {
    const a = parseAmount(raw.amount)
    if (!a.ok) return a
    patch.amount = a.amount
  }
  if (has("status")) {
    const v = str(raw.status) as ConsultationStatus
    if (!CONSULTATION_STATUSES.includes(v)) return { ok: false, error: "Unknown consultation status." }
    patch.status = v
  }
  if (has("outcome")) {
    if (raw.outcome !== null && typeof raw.outcome !== "string") {
      return { ok: false, error: "outcome must be a string or null." }
    }
    patch.outcome = str(raw.outcome) || null
  }

  return { ok: true, value: patch }
}
