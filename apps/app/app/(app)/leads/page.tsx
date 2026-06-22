import { LeadsTable } from "@/components/leads/leads-table"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import { PageHeader } from "@/components/page-header"
import { LEADS, STAFF } from "@/data"
import { getCurrentUser } from "@/lib/auth/session"
import {
  mapLeadRow,
  mapLeadStatus,
  mapMockLead,
  mockLeadStatuses,
  type AssigneeOption,
  type LeadStatusView,
  type LeadView,
} from "@/lib/leads/queries"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import { groupTaxonomies, mockTaxonomies, type FirmTaxonomies } from "@/lib/taxonomies/queries"

export const metadata = { title: "Leads" }

type Loaded = {
  leads: LeadView[]
  statuses: LeadStatusView[]
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  canEdit: boolean
  canManage: boolean
}

async function load(): Promise<Loaded> {
  // Demo fallback: render the mock pipeline read-only when Supabase isn't configured.
  if (!isSupabaseConfigured()) {
    const statuses = mockLeadStatuses()
    const byKey = new Map(statuses.map((s) => [s.key, s]))
    return {
      leads: LEADS.map((l) => mapMockLead(l, byKey)).filter((l): l is LeadView => l !== null),
      statuses,
      assignees: STAFF.filter((u) => u.role === "sales").map((u) => ({ id: u.id, name: u.name })),
      taxonomies: mockTaxonomies(),
      canEdit: false,
      canManage: false,
    }
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  // RLS scopes all three to the caller's firm.
  const [leadsRes, statusesRes, assigneesRes, taxRes] = await Promise.all([
    supabase.from("leads").select("*").order("last_activity", { ascending: false }),
    supabase.from("lead_statuses").select("*").order("position"),
    supabase.from("profiles").select("id, name").eq("status", "active").order("name"),
    supabase.from("firm_taxonomies").select("*").order("position"),
  ])
  if (leadsRes.error) throw leadsRes.error
  if (statusesRes.error) throw statusesRes.error
  if (assigneesRes.error) throw assigneesRes.error
  if (taxRes.error) throw taxRes.error

  const statuses = (statusesRes.data ?? []).map(mapLeadStatus)
  const byId = new Map(statuses.map((s) => [s.id, s]))
  return {
    leads: (leadsRes.data ?? []).map((r) => mapLeadRow(r, byId)).filter((l): l is LeadView => l !== null),
    statuses,
    assignees: (assigneesRes.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    taxonomies: groupTaxonomies(taxRes.data ?? []),
    canEdit: me?.permissions?.includes("leads.edit") ?? false,
    canManage: me?.permissions?.includes("settings.manage") ?? false,
  }
}

export default async function LeadsPage() {
  const { leads, statuses, assignees, taxonomies, canEdit, canManage } = await load()
  return (
    <>
      <PageHeader
        title="Leads"
        description="Capture, qualify, and track leads through the conversion pipeline."
      >
        {canEdit ? <NewLeadDialog assignees={assignees} taxonomies={taxonomies} canManage={canManage} /> : null}
      </PageHeader>
      <LeadsTable
        leads={leads}
        statuses={statuses}
        assignees={assignees}
        taxonomies={taxonomies}
        canEdit={canEdit}
        canManage={canManage}
      />
    </>
  )
}
