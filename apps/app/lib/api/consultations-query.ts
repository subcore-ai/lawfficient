// DB reads for the public consultations API (spec 13 + 26), via the fail-safe tenant-scoped wrapper
// (tenant-db). The admin client bypasses RLS, so every read goes through `db.from(...)`, which pins the
// firm predicate by construction — an unscoped cross-firm read can't be written here. Ordering is keyset
// on the IMMUTABLE pair (created_at desc, id desc) — not start_at or last_activity, which mutate on a
// reschedule and would corrupt cursor paging. Rows map through the shared ConsultationView mapper + the
// shared serializer, so the public shape never diverges from the calendar/board's.
import {
  mapConsultationRow,
  type ConsultationView,
} from "@/lib/consultations/queries"
import { CONSULTATION_STATUSES, type ConsultationStatus } from "@/lib/consultations/validation"
import { serializeConsultation, type ApiConsultation } from "./consultations"
import { buildPage, type Cursor, type Page } from "./pagination"
import type { TenantDb } from "./tenant-db"
import { isUuid } from "./validation"

export type ConsultationFilters = {
  attorney?: string // attorney_id (uuid)
  lead?: string // lead_id (uuid)
  status?: string // a consultation_status enum value
  archived?: string // "true" | "false"; default: only non-archived
}

// The public shape exposes ids, not resolved names — but mapConsultationRow needs name maps for its view
// fields (leadName/attorneyName), which the serializer drops. Empty maps yield fallbacks that never
// surface, so we skip the (extra) name lookups entirely on the API path.
const EMPTY_NAMES = new Map<string, string>()

function toApi(row: Parameters<typeof mapConsultationRow>[0]): ApiConsultation {
  const view: ConsultationView = mapConsultationRow(row, EMPTY_NAMES, EMPTY_NAMES)
  return serializeConsultation(view)
}

// One page of the firm's consultations, newest-first, filtered, with an opaque next cursor.
export async function getApiConsultationsPage(
  db: TenantDb,
  limit: number,
  cursor: Cursor | null,
  filters: ConsultationFilters,
): Promise<Page<ApiConsultation>> {
  // status filter must be a known enum value; an unknown one matches nothing (avoids a 500 on the cast).
  let status: ConsultationStatus | null = null
  if (filters.status) {
    if (!CONSULTATION_STATUSES.includes(filters.status as ConsultationStatus)) {
      return { data: [], next_cursor: null }
    }
    status = filters.status as ConsultationStatus
  }

  let query = db
    .from("consultations")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1) // +1 sentinel → buildPage detects a further page

  // Default to NON-archived (the active set); `?archived=true` returns archived only, `?archived=false`
  // is explicit non-archived. Any other value is treated as the default (non-archived).
  if (filters.archived === "true") query = query.eq("archived", true)
  else query = query.eq("archived", false)

  if (status) query = query.eq("status", status)
  // A non-UUID attorney/lead can't match the uuid column — and `.eq` would 500 on the cast — so an
  // invalid value is an empty page, not an error.
  if (filters.attorney) {
    if (!isUuid(filters.attorney)) return { data: [], next_cursor: null }
    query = query.eq("attorney_id", filters.attorney)
  }
  if (filters.lead) {
    if (!isUuid(filters.lead)) return { data: [], next_cursor: null }
    query = query.eq("lead_id", filters.lead)
  }

  // Keyset: rows strictly "after" the cursor in (created_at desc, id desc) order. The cursor is opaque
  // but client-supplied, so validate the decoded parts before embedding them in the PostgREST filter — a
  // forged cursor must not be able to inject filter syntax. id is a uuid; createdAt is a timestamp with
  // no filter metacharacters.
  if (cursor) {
    if (!isUuid(cursor.id) || /[(),]/.test(cursor.createdAt) || Number.isNaN(Date.parse(cursor.createdAt))) {
      return { data: [], next_cursor: null }
    }
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) throw error

  const consultations = (data ?? []).map(toApi)
  return buildPage(consultations, limit, (c) => ({ createdAt: c.created_at, id: c.id }))
}

// A single firm-scoped consultation, or null if it doesn't exist / belongs to another firm.
export async function getApiConsultationById(db: TenantDb, id: string): Promise<ApiConsultation | null> {
  // A non-UUID id can't be a real consult (and `.eq("id", …)` would 500 on the uuid cast) → 404.
  if (!isUuid(id)) return null
  const { data, error } = await db.from("consultations").eq("id", id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return toApi(data)
}
