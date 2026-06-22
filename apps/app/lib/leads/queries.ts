// Lead view model: maps a DB row + the firm's statuses into one shape the board, detail, and
// dashboard all consume. Keeps the firm-defined status resolved and the jsonb narrowed in one place.
import type { Tone } from "@/components/status-pill"
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

// A staff member a lead can be assigned to (resolved from profiles).
export type AssigneeOption = { id: string; name: string }

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
