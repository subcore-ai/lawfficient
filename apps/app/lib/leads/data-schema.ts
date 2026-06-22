// Typed boundary around leads.data — a deliberately schemaless jsonb column holding the
// variable "rest" of a lead (demographics, case details, source-mapped/ingestion fields).
// parseLeadData narrows the stored blob for display; buildLeadData validates raw form input
// before persisting. The constrained fields (case type / hierarchy / qualification) are now
// firm-defined (see firm_taxonomies), so their vocabulary is PASSED IN rather than hard-coded —
// keeping these functions pure + unit-testable. Dependency-free.
import type { Json } from "@/lib/supabase/database.types"

export type LeadData = {
  caseType?: string
  hierarchy?: string
  qualification?: string
  preferredLanguage?: string
  countryOfOrigin?: string
  city?: string
  state?: string
  zip?: string
  gender?: string
  dob?: string
  referralSource?: string
}

// The firm's allowed values per constrained field (active taxonomy labels). buildLeadData
// validates writes against this; see lib/taxonomies/queries.ts `vocab()`.
export type LeadVocab = { caseType: string[]; hierarchy: string[]; qualification: string[] }

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

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

// Narrow the stored jsonb to LeadData for display. LENIENT for the firm-defined fields: a stored
// value is kept verbatim (a firm may have renamed/retired a taxonomy, but the historical label
// must still render). NEW values are validated on the write path (buildLeadData). Unknown/extra
// keys (e.g. raw ingestion payload) stay in the column; they just aren't surfaced as typed fields.
export function parseLeadData(json: Json | null | undefined): LeadData {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {}
  const o = json as Record<string, unknown>
  const out: LeadData = {}

  const caseType = cleanString(o.caseType)
  if (caseType) out.caseType = caseType
  const hierarchy = cleanString(o.hierarchy)
  if (hierarchy) out.hierarchy = hierarchy
  const qualification = cleanString(o.qualification)
  if (qualification) out.qualification = qualification

  for (const k of LEAD_DATA_TEXT_KEYS) {
    const v = cleanString(o[k])
    if (v) out[k] = v
  }
  return out
}

export type LeadDataInput = Partial<Record<keyof LeadData, string | undefined>>

// Validate + assemble the jsonb payload from raw form values. Constrained fields are checked
// against the firm's vocabulary (passed in); free-text fields are trimmed and dropped when empty.
export function buildLeadData(
  input: LeadDataInput,
  vocab: LeadVocab
): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  const value: Record<string, string> = {}

  const caseType = cleanString(input.caseType)
  if (caseType) {
    if (!vocab.caseType.includes(caseType)) return { ok: false, error: "Invalid case type." }
    value.caseType = caseType
  }
  const hierarchy = cleanString(input.hierarchy)
  if (hierarchy) {
    if (!vocab.hierarchy.includes(hierarchy)) return { ok: false, error: "Invalid hierarchy." }
    value.hierarchy = hierarchy
  }
  const qualification = cleanString(input.qualification)
  if (qualification) {
    if (!vocab.qualification.includes(qualification)) return { ok: false, error: "Invalid qualification." }
    value.qualification = qualification
  }
  for (const k of LEAD_DATA_TEXT_KEYS) {
    const v = cleanString(input[k])
    if (v) value[k] = v
  }
  return { ok: true, value }
}

// Every key the lead form manages.
const LEAD_DATA_KEYS = ["caseType", "hierarchy", "qualification", ...LEAD_DATA_TEXT_KEYS] as const

// Merge a freshly-built form payload over the existing jsonb: the form-managed keys are fully
// replaced (a cleared field drops out), but any OTHER keys — e.g. ingestion payload kept verbatim
// (see parseLeadData) — are preserved. Used by updateLead so an edit never wipes unsurfaced data.
export function mergeLeadData(
  existing: Json | null | undefined,
  formValue: Record<string, string>
): Record<string, Json> {
  const base: Record<string, Json> =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, Json>) }
      : {}
  for (const key of LEAD_DATA_KEYS) delete base[key]
  return { ...base, ...formValue }
}
