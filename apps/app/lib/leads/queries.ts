// Lead view model: maps a DB row (+ the firm's statuses) — or a mock-store Lead — into one
// shape the board, detail, and dashboard all consume. Keeps the firm-defined status
// resolved and the jsonb narrowed in a single place.
import type { Tone } from "@/components/status-pill"
import type { Lead, LeadStatus } from "@/data/types"
import { leadStatusBadge } from "@/lib/status"
import type { Database } from "@/lib/supabase/database.types"
import { parseLeadData, type LeadData } from "./data-schema"

type LeadRow = Database["public"]["Tables"]["leads"]["Row"]
type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"]

export type LeadStatusView = {
  id: string
  key: string
  name: string
  tone: Tone
  isTerminal: boolean
  position: number
}

export type LeadView = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  source: string
  assignedToId: string | null
  status: LeadStatusView
  archived: boolean
  createdAt: string
  lastActivity: string
  notes: string | null
  data: LeadData
}

const TONES: Tone[] = ["neutral", "info", "success", "warning", "danger", "purple"]
function toTone(value: string): Tone {
  return (TONES as string[]).includes(value) ? (value as Tone) : "neutral"
}

export function mapLeadStatus(row: LeadStatusRow): LeadStatusView {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    tone: toTone(row.tone),
    isTerminal: row.is_terminal,
    position: row.position,
  }
}

// Returns null if the lead's status isn't in the map — impossible given the FK + loading all
// firm statuses, but keeps the mapper total. Callers filter nulls.
export function mapLeadRow(row: LeadRow, statusesById: Map<string, LeadStatusView>): LeadView | null {
  const status = statusesById.get(row.status_id)
  if (!status) return null
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    assignedToId: row.assigned_to_id,
    status,
    archived: row.archived,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
    notes: row.notes,
    data: parseLeadData(row.data),
  }
}

// ---- Mock fallback (no Supabase configured): synthesize the firm-defined statuses from the
// legacy enum + lib/status.ts so the same board renders read-only in demo mode. ----

const MOCK_STATUS_ORDER: LeadStatus[] = [
  "new",
  "contacted",
  "consult_scheduled",
  "scheduled_paid",
  "qualified_followup",
  "ea_sent",
  "retained",
  "not_qualified",
  "lost",
]
const MOCK_TERMINAL = new Set<LeadStatus>(["retained", "not_qualified", "lost"])

export function mockLeadStatuses(): LeadStatusView[] {
  return MOCK_STATUS_ORDER.map((key, position) => ({
    id: key,
    key,
    name: leadStatusBadge(key).label,
    tone: leadStatusBadge(key).tone,
    isTerminal: MOCK_TERMINAL.has(key),
    position,
  }))
}

export function mapMockLead(lead: Lead, statusesByKey: Map<string, LeadStatusView>): LeadView | null {
  const status = statusesByKey.get(lead.status)
  if (!status) return null
  const data: LeadData = { qualification: lead.qualification }
  if (lead.caseType) data.caseType = lead.caseType
  if (lead.hierarchy) data.hierarchy = lead.hierarchy
  if (lead.preferredLanguage) data.preferredLanguage = lead.preferredLanguage
  if (lead.countryOfOrigin) data.countryOfOrigin = lead.countryOfOrigin
  if (lead.city) data.city = lead.city
  if (lead.state) data.state = lead.state
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    assignedToId: lead.assignedToId,
    status,
    archived: lead.archived ?? false,
    createdAt: lead.createdAt,
    lastActivity: lead.lastActivity,
    notes: lead.notes ?? null,
    data,
  }
}
