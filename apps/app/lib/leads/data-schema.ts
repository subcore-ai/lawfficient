// Typed boundary around leads.data — a deliberately schemaless jsonb column holding the
// variable "rest" of a lead (demographics, case details, future source-mapped/ingestion
// fields). parseLeadData narrows the stored blob for display; buildLeadData validates raw
// form input before persisting. Pure + dependency-free so it can be unit-tested directly.
import { CASE_TYPES, type CaseHierarchy, type CaseType, type Qualification } from "@/data/types"
import type { Json } from "@/lib/supabase/database.types"

export type LeadData = {
  caseType?: CaseType
  hierarchy?: CaseHierarchy
  qualification?: Qualification
  preferredLanguage?: string
  countryOfOrigin?: string
  city?: string
  state?: string
  zip?: string
  gender?: string
  dob?: string
  referralSource?: string
}

// Free-text keys (no constrained vocabulary) — stored/displayed as-is when non-empty.
export const LEAD_DATA_TEXT_KEYS = [
  "preferredLanguage",
  "countryOfOrigin",
  "city",
  "state",
  "zip",
  "gender",
  "dob",
  "referralSource",
] as const

const HIERARCHIES: CaseHierarchy[] = ["HRC", "NHRC"]
const QUALIFICATIONS: Qualification[] = ["qualified", "not_qualified", "pending"]

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

// Narrow the stored jsonb to LeadData: keep only known keys with valid types, drop the
// rest. Unknown/extra keys (e.g. raw ingestion payload) are intentionally ignored here —
// they stay in the column, they just aren't surfaced as typed fields.
export function parseLeadData(json: Json | null | undefined): LeadData {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {}
  const o = json as Record<string, unknown>
  const out: LeadData = {}

  const caseType = cleanString(o.caseType)
  if (caseType && (CASE_TYPES as string[]).includes(caseType)) out.caseType = caseType as CaseType

  const hierarchy = cleanString(o.hierarchy)
  if (hierarchy && (HIERARCHIES as string[]).includes(hierarchy)) out.hierarchy = hierarchy as CaseHierarchy

  const qualification = cleanString(o.qualification)
  if (qualification && (QUALIFICATIONS as string[]).includes(qualification))
    out.qualification = qualification as Qualification

  for (const k of LEAD_DATA_TEXT_KEYS) {
    const v = cleanString(o[k])
    if (v) out[k] = v
  }
  return out
}

export type LeadDataInput = Partial<Record<keyof LeadData, string | undefined>>

// Validate + assemble the jsonb payload from raw form values. Constrained fields are
// checked against their vocabulary; free-text fields are trimmed and dropped when empty.
export function buildLeadData(
  input: LeadDataInput
): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  const value: Record<string, string> = {}

  const caseType = cleanString(input.caseType)
  if (caseType) {
    if (!(CASE_TYPES as string[]).includes(caseType)) return { ok: false, error: "Invalid case type." }
    value.caseType = caseType
  }
  const hierarchy = cleanString(input.hierarchy)
  if (hierarchy) {
    if (!(HIERARCHIES as string[]).includes(hierarchy)) return { ok: false, error: "Invalid hierarchy." }
    value.hierarchy = hierarchy
  }
  const qualification = cleanString(input.qualification)
  if (qualification) {
    if (!(QUALIFICATIONS as string[]).includes(qualification))
      return { ok: false, error: "Invalid qualification." }
    value.qualification = qualification
  }
  for (const k of LEAD_DATA_TEXT_KEYS) {
    const v = cleanString(input[k])
    if (v) value[k] = v
  }
  return { ok: true, value }
}
