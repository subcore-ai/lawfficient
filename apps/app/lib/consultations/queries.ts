// Pure read helpers for consultations (mirrors lib/leads/queries.ts): row → view with names resolved
// from a profiles/leads name map, plus the upcoming/past partition the list page renders. Kept pure so
// they're unit-tested without a DB.
import { jsonRecord } from "@/lib/json"
import type { Database, Json } from "@/lib/supabase/database.types"
import type { Tone } from "@/components/status-pill"
import type { ConsultationStatus } from "./validation"

type ConsultationRow = Database["public"]["Tables"]["consultations"]["Row"]

export type ConsultationView = {
  id: string
  leadId: string | null
  leadName: string
  attorneyId: string | null
  attorneyName: string | null
  type: string
  status: ConsultationStatus
  startAt: string
  durationMin: number
  timeZone: string
  paid: boolean
  amount: number | null
  outcome: string | null
  bookedById: string | null
  archived: boolean
  createdAt: string
  data: Record<string, Json>
}

// Display label + tone per status (the lifecycle is a fixed enum, so this map is exhaustive).
const STATUS_META: Record<ConsultationStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "info" },
  paid: { label: "Scheduled · paid", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  rescheduled: { label: "Rescheduled", tone: "warning" },
  canceled: { label: "Canceled", tone: "neutral" },
  no_show: { label: "No-show", tone: "danger" },
}
export function consultationStatusMeta(status: ConsultationStatus): { label: string; tone: Tone } {
  return STATUS_META[status]
}

// Resolve names from maps (leadId → name, profileId → name), like the lead page resolves assignees.
export function mapConsultationRow(
  row: ConsultationRow,
  leadNames: Map<string, string>,
  profileNames: Map<string, string>,
): ConsultationView {
  return {
    id: row.id,
    leadId: row.lead_id,
    leadName: (row.lead_id ? leadNames.get(row.lead_id) : undefined) ?? "Unknown lead",
    attorneyId: row.attorney_id,
    attorneyName: row.attorney_id ? (profileNames.get(row.attorney_id) ?? null) : null,
    type: row.type,
    status: row.status,
    startAt: row.start_at,
    durationMin: row.duration_min,
    timeZone: row.time_zone,
    paid: row.paid,
    amount: row.amount,
    outcome: row.outcome,
    bookedById: row.booked_by_id,
    archived: row.archived,
    createdAt: row.created_at,
    data: jsonRecord(row.data),
  }
}

// A consultation is "done" once it's completed, canceled, or a no-show — those never count as upcoming
// regardless of their start time.
function isDone(status: ConsultationStatus): boolean {
  return status === "completed" || status === "canceled" || status === "no_show"
}

// Split into upcoming (not done AND starts at/after `now`) vs past (everything else). Upcoming sorts
// soonest-first; past sorts most-recent-first.
export function partitionConsultations(
  views: ConsultationView[],
  nowIso: string,
): { upcoming: ConsultationView[]; past: ConsultationView[] } {
  const now = Date.parse(nowIso)
  const upcoming: ConsultationView[] = []
  const past: ConsultationView[] = []
  for (const v of views) {
    if (!isDone(v.status) && Date.parse(v.startAt) >= now) upcoming.push(v)
    else past.push(v)
  }
  upcoming.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  past.sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt))
  return { upcoming, past }
}
