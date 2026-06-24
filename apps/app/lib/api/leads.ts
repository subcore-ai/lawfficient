// The STABLE public JSON shape for a lead (spec 26) — the API contract, decoupled from the DB
// columns and the internal LeadView. Defined once and reused by both GET endpoints. Notably it
// does NOT leak internal columns (firm_id, external_id, the raw status_id); the firm-defined
// status is exposed by its stable `key` + display `name`. Timestamps are ISO-8601 UTC (as
// stored); ids are UUIDs.
import type { LeadView } from "@/lib/leads/queries"

export type ApiLead = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  source: string
  status: { key: string; name: string }
  assignee_id: string | null
  archived: boolean
  created_at: string
  last_activity_at: string
  data: LeadView["data"]
}

export function serializeLead(lead: LeadView): ApiLead {
  return {
    id: lead.id,
    first_name: lead.firstName,
    last_name: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: { key: lead.status.key, name: lead.status.name },
    assignee_id: lead.assignedToId,
    archived: lead.archived,
    created_at: lead.createdAt,
    last_activity_at: lead.lastActivity,
    data: lead.data,
  }
}
