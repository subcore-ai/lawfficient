// Firm-defined taxonomies (case type / hierarchy / qualification; extensible) resolved into one
// shape for the lead form, the settings editor, and the ingestion vocab. Mirrors lib/leads/queries.ts.
import type { LeadVocab } from "@/lib/leads/data-schema"
import type { Database } from "@/lib/supabase/database.types"

export type TaxonomyCategory = "case_type" | "case_hierarchy" | "qualification"

export const TAXONOMY_CATEGORIES: TaxonomyCategory[] = ["case_type", "case_hierarchy", "qualification"]

export type TaxonomyOption = {
  id: string
  category: TaxonomyCategory
  label: string
  notes: string | null
  position: number
  isSystem: boolean
  isActive: boolean
}

export type FirmTaxonomies = Record<TaxonomyCategory, TaxonomyOption[]>

type TaxonomyRow = Database["public"]["Tables"]["firm_taxonomies"]["Row"]

export function mapTaxonomy(row: TaxonomyRow): TaxonomyOption {
  return {
    id: row.id,
    category: row.category as TaxonomyCategory,
    label: row.label,
    notes: row.notes,
    position: row.position,
    isSystem: row.is_system,
    isActive: row.is_active,
  }
}

function emptyGroups(): FirmTaxonomies {
  return { case_type: [], case_hierarchy: [], qualification: [] }
}

// One `select * order by position` → split by category in memory.
export function groupTaxonomies(rows: TaxonomyRow[]): FirmTaxonomies {
  const out = emptyGroups()
  for (const row of [...rows].sort((a, b) => a.position - b.position)) {
    const cat = row.category as TaxonomyCategory
    if (out[cat]) out[cat].push(mapTaxonomy(row))
  }
  return out
}

// Active labels for a category — the vocabulary a form / validator / ingest accepts.
export function vocab(t: FirmTaxonomies, category: TaxonomyCategory): string[] {
  return t[category].filter((o) => o.isActive).map((o) => o.label)
}

// The LeadVocab that buildLeadData / parseCanonicalPayload validate against.
export function toLeadVocab(t: FirmTaxonomies): LeadVocab {
  return {
    caseType: vocab(t, "case_type"),
    hierarchy: vocab(t, "case_hierarchy"),
    qualification: vocab(t, "qualification"),
  }
}

// Mock fallback (no Supabase configured): synthesize the defaults so the form renders read-only in
// demo mode. Mirrors lib/leads/queries.ts mockLeadStatuses.
const MOCK: Record<TaxonomyCategory, string[]> = {
  case_type: [
    "VAWA (Abeyance)",
    "VAWA (AOS)",
    "Marriage-Based GC",
    "N-400 Naturalization",
    "Family-Based Petition",
    "NVC Case",
    "Removal of Conditions",
  ],
  case_hierarchy: ["HRC", "NHRC"],
  qualification: ["pending", "qualified", "not_qualified"],
}

export function mockTaxonomies(): FirmTaxonomies {
  const out = emptyGroups()
  for (const category of TAXONOMY_CATEGORIES) {
    out[category] = MOCK[category].map((label, position) => ({
      id: `${category}:${label}`,
      category,
      label,
      notes: null,
      position,
      isSystem: true,
      isActive: true,
    }))
  }
  return out
}
