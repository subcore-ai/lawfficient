// The STABLE public JSON shape for a consultation (spec 13 + 26) — the API contract, decoupled from
// the DB columns and the internal ConsultationView. Reused by the list + fetch-one endpoints and the
// webhook payload. It does NOT leak internal columns (firm_id, booked_by_id); resolved display names
// (lead/attorney) are an internal concern and stay out — the API exposes the ids. Timestamps are
// ISO-8601 UTC (as stored); ids are UUIDs; `data` is the schemaless practice-specific jsonb.
import type { ConsultationView } from "@/lib/consultations/queries"

export type ApiConsultation = {
  id: string
  lead_id: string | null
  attorney_id: string | null
  type: string
  status: string
  start_at: string
  duration_min: number
  time_zone: string
  paid: boolean
  amount: number | null
  outcome: string | null
  archived: boolean
  created_at: string
  data: ConsultationView["data"]
}

export function serializeConsultation(c: ConsultationView): ApiConsultation {
  return {
    id: c.id,
    lead_id: c.leadId,
    attorney_id: c.attorneyId,
    type: c.type,
    status: c.status,
    start_at: c.startAt,
    duration_min: c.durationMin,
    time_zone: c.timeZone,
    paid: c.paid,
    amount: c.amount,
    outcome: c.outcome,
    archived: c.archived,
    created_at: c.createdAt,
    data: c.data,
  }
}
