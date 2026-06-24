// DB reads for the public leads API (spec 26), via the service-role admin client (no user
// session → RLS does not apply, so EVERY query filters by the resolved firmId explicitly).
// Ordering is keyset on the IMMUTABLE pair (created_at desc, id desc) — not last_activity, which
// mutates and would corrupt cursor paging. Results are mapped through the shared LeadView mapper
// and the shared serializer, so the public shape never diverges from the board's.
import { mapLeadRow, mapLeadStatus, type LeadStatusView } from "@/lib/leads/queries"
import type { createAdminClient } from "@/lib/supabase/admin"
import { buildPage, type Cursor, type Page } from "./pagination"
import { serializeLead, type ApiLead } from "./leads"
import { isUuid } from "./validation"

type Admin = ReturnType<typeof createAdminClient>

export type LeadFilters = {
  status?: string // firm-defined status key
  source?: string // exact source label
  assignee?: string // assigned_to_id (uuid)
  q?: string // free text over name / email / phone
}

// Escape PostgREST `or`/`ilike` metacharacters in user-supplied search text so a `,` or `*`
// can't break out of the filter expression or widen the match.
function sanitizeLike(term: string): string {
  return term.replace(/[,()*\\]/g, " ").trim()
}

async function loadStatusMap(admin: Admin, firmId: string): Promise<Map<string, LeadStatusView>> {
  const { data, error } = await admin.from("lead_statuses").select("*").eq("firm_id", firmId).order("position")
  if (error) throw error
  return new Map((data ?? []).map((row) => [row.id, mapLeadStatus(row)]))
}

// One page of the firm's leads, newest-first, filtered, with an opaque next cursor.
export async function getApiLeadsPage(
  admin: Admin,
  firmId: string,
  limit: number,
  cursor: Cursor | null,
  filters: LeadFilters,
): Promise<Page<ApiLead>> {
  const statusesById = await loadStatusMap(admin, firmId)

  // status filter resolves the firm's status KEY → its id; an unknown key matches nothing.
  let statusId: string | null = null
  if (filters.status) {
    const match = [...statusesById.values()].find((s) => s.key === filters.status)
    if (!match) return { data: [], next_cursor: null }
    statusId = match.id
  }

  let query = admin
    .from("leads")
    .select("*")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1) // +1 sentinel → buildPage detects a further page

  if (statusId) query = query.eq("status_id", statusId)
  if (filters.source) query = query.eq("source", filters.source)
  // A non-UUID assignee can't match the uuid column — and `.eq` would 500 on the cast — so an
  // invalid value is an empty page, not an error.
  if (filters.assignee) {
    if (!isUuid(filters.assignee)) return { data: [], next_cursor: null }
    query = query.eq("assigned_to_id", filters.assignee)
  }

  if (filters.q) {
    const term = sanitizeLike(filters.q)
    if (term) {
      const like = `*${term}*`
      query = query.or(
        `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
      )
    }
  }

  // Keyset: rows strictly "after" the cursor in (created_at desc, id desc) order. Successive
  // PostgREST .or() groups AND together, so this composes with the text search above.
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) throw error

  const leads = (data ?? [])
    .map((row) => mapLeadRow(row, statusesById))
    .filter((l) => l !== null)
    .map(serializeLead)

  return buildPage(leads, limit, (l) => ({ createdAt: l.created_at, id: l.id }))
}

// A single firm-scoped lead, or null if it doesn't exist / belongs to another firm.
export async function getApiLeadById(admin: Admin, firmId: string, id: string): Promise<ApiLead | null> {
  // A non-UUID id can't be a real lead (and `.eq("id", …)` would 500 on the uuid cast) → 404.
  if (!isUuid(id)) return null
  const { data, error } = await admin
    .from("leads")
    .select("*")
    .eq("firm_id", firmId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const statusesById = await loadStatusMap(admin, firmId)
  const lead = mapLeadRow(data, statusesById)
  return lead ? serializeLead(lead) : null
}
