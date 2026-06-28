import { LeadsTable, type LeadsFilters } from "@/components/leads/leads-table"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import { PageHeader } from "@/components/page-header"
import { getCurrentUser } from "@/lib/auth/session"
import {
  mapLeadRow,
  mapLeadStatus,
  type AssigneeOption,
  type LeadView,
} from "@/lib/leads/queries"
import { getFirmStaff, getFirmStatusRows, getFirmTaxonomyRows } from "@/lib/reference"
import { createClient } from "@/lib/supabase/server"
import { groupTaxonomies } from "@/lib/taxonomies/queries"

export const metadata = { title: "Leads" }

const PAGE_SIZE = 50
const UNASSIGNED = "__none__" // mirrors the table's "Unassigned" sentinel

type Search = Record<string, string | string[] | undefined>
function one(sp: Search, key: string): string | undefined {
  const v = sp[key]
  return typeof v === "string" && v !== "" ? v : undefined
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const me = await getCurrentUser()
  const canEdit = me?.permissions?.includes("leads.edit") ?? false
  const canManage = me?.permissions?.includes("settings.manage") ?? false

  const status = one(sp, "status")
  const source = one(sp, "source")
  const assignee = one(sp, "assignee")
  const rawQ = one(sp, "q") ?? ""
  const q = rawQ.trim().toLowerCase()
  const showArchived = one(sp, "archived") === "1"
  const page = Math.max(1, Number(one(sp, "page")) || 1)

  const supabase = await createClient()
  // One filtered + paginated read (exact count comes back with it), plus the per-firm reference + the facet
  // counts. Server-side filtering replaces the old unbounded select(*) that truncated past 1000 rows.
  let leadsQuery = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("last_activity", { ascending: false })
  if (!showArchived) leadsQuery = leadsQuery.eq("archived", false)
  if (status) leadsQuery = leadsQuery.eq("status_id", status)
  if (source) leadsQuery = leadsQuery.eq("source", source)
  if (assignee === UNASSIGNED) leadsQuery = leadsQuery.is("assigned_to_id", null)
  else if (assignee) leadsQuery = leadsQuery.eq("assigned_to_id", assignee)
  if (q) leadsQuery = leadsQuery.ilike("search_text", `%${q}%`)
  leadsQuery = leadsQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const [leadsRes, statusRows, staff, taxRows, facetsRes] = await Promise.all([
    leadsQuery,
    me ? getFirmStatusRows(me.firmId) : Promise.resolve([]),
    me ? getFirmStaff(me.firmId) : Promise.resolve([]),
    me ? getFirmTaxonomyRows(me.firmId) : Promise.resolve([]),
    supabase.rpc("lead_facets"),
  ])
  if (leadsRes.error) throw leadsRes.error

  const statuses = statusRows.map(mapLeadStatus)
  const byId = new Map(statuses.map((s) => [s.id, s]))
  const facets = (facetsRes.data ?? {}) as { statusCounts?: Record<string, number>; archived?: number }
  const leads = (leadsRes.data ?? []).map((r) => mapLeadRow(r, byId)).filter((l): l is LeadView => l !== null)
  const assignees: AssigneeOption[] = staff
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name }))
  const taxonomies = groupTaxonomies(taxRows)
  const filters: LeadsFilters = {
    status: status ?? "",
    source: source ?? "",
    assignee: assignee ?? "",
    q: rawQ,
    showArchived,
  }

  return (
    <>
      <PageHeader title="Leads" description="Capture, qualify, and track leads through the conversion pipeline.">
        {canEdit ? <NewLeadDialog assignees={assignees} taxonomies={taxonomies} canManage={canManage} /> : null}
      </PageHeader>
      <LeadsTable
        leads={leads}
        statuses={statuses}
        statusCounts={facets.statusCounts ?? {}}
        archivedCount={facets.archived ?? 0}
        assignees={assignees}
        taxonomies={taxonomies}
        filters={filters}
        page={page}
        pageSize={PAGE_SIZE}
        total={leadsRes.count ?? 0}
        canEdit={canEdit}
        canManage={canManage}
      />
    </>
  )
}
