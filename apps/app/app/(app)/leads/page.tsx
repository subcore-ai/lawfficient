import { LeadsTable } from "@/components/leads/leads-table"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import { PageHeader } from "@/components/page-header"
import { getCurrentUser } from "@/lib/auth/session"
import {
  mapLeadRow,
  mapLeadStatus,
  type AssigneeOption,
  type LeadStatusView,
  type LeadView,
} from "@/lib/leads/queries"
import {
  getFirmStaff,
  getFirmStatusRows,
  getFirmTaxonomyRows,
} from "@/lib/reference"
import { createClient } from "@/lib/supabase/server"
import { groupTaxonomies, type FirmTaxonomies } from "@/lib/taxonomies/queries"

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
  const me = await getCurrentUser()
  if (!me)
    return {
      leads: [],
      statuses: [],
      assignees: [],
      taxonomies: groupTaxonomies([]),
      canEdit: false,
      canManage: false,
    }
  const supabase = await createClient()
  // Leads stay on the RLS client; statuses / staff / taxonomies come from the per-firm cache.
  const [leadsRes, statusRows, staff, taxRows] = await Promise.all([
    supabase.from("leads").select("*").order("last_activity", { ascending: false }),
    getFirmStatusRows(me.firmId),
    getFirmStaff(me.firmId),
    getFirmTaxonomyRows(me.firmId),
  ])
  if (leadsRes.error) throw leadsRes.error

  const statuses = statusRows.map(mapLeadStatus)
  const byId = new Map(statuses.map((s) => [s.id, s]))
  return {
    leads: (leadsRes.data ?? [])
      .map((r) => mapLeadRow(r, byId))
      .filter((l): l is LeadView => l !== null),
    statuses,
    assignees: staff
      .filter((p) => p.status === "active")
      .map((p) => ({ id: p.id, name: p.name })),
    taxonomies: groupTaxonomies(taxRows),
    canEdit: me.permissions?.includes("leads.edit") ?? false,
    canManage: me.permissions?.includes("settings.manage") ?? false,
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
