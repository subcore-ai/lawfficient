import { DashboardView } from "@/components/dashboard-view"
import { LEADS } from "@/data"
import { getCurrentUser } from "@/lib/auth/session"
import type { AssigneeOption } from "@/lib/leads/queries"
import {
  getFirmStaff,
  getFirmStatusRows,
  getFirmTaxonomyRows,
} from "@/lib/reference"
import { createClient } from "@/lib/supabase/server"
import { groupTaxonomies, type FirmTaxonomies } from "@/lib/taxonomies/queries"

export const metadata = { title: "Dashboard" }

const NIL_UUID = "00000000-0000-0000-0000-000000000000"

type Loaded = {
  openLeads: number
  eaOut: number
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  canCreateLead: boolean
  canManage: boolean
}

const MOCK_TERMINAL = ["retained", "lost", "not_qualified"]
function mockLeadCounts() {
  return {
    openLeads: LEADS.filter((l) => !l.archived && !MOCK_TERMINAL.includes(l.status)).length,
    eaOut: LEADS.filter((l) => !l.archived && l.status === "ea_sent").length,
  }
}

// The two lead KPIs come from real counts; the rest of the dashboard stays on the mock store.
async function load(): Promise<Loaded> {
  const me = await getCurrentUser()
  if (!me)
    return {
      ...mockLeadCounts(),
      assignees: [],
      taxonomies: groupTaxonomies([]),
      canCreateLead: false,
      canManage: false,
    }
  const supabase = await createClient()
  const canCreateLead = me.permissions?.includes("leads.edit") ?? false
  const canManage = me.permissions?.includes("settings.manage") ?? false

  // Assignees + taxonomies from the per-firm cache.
  const [staff, taxRows] = await Promise.all([
    getFirmStaff(me.firmId),
    getFirmTaxonomyRows(me.firmId),
  ])
  const assignees = staff
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name }))
  const taxonomies = groupTaxonomies(taxRows)

  // The lead KPIs need leads.view. For roles without it (QA lead, creative writer, file clerk)
  // keep them on the mock counts like the rest of the dashboard, rather than a misleading 0.
  if (!(me.permissions?.includes("leads.view") ?? false)) {
    return { ...mockLeadCounts(), assignees, taxonomies, canCreateLead, canManage }
  }

  const statuses = await getFirmStatusRows(me.firmId)
  const openIds = statuses.filter((s) => !s.is_terminal).map((s) => s.id)
  const eaId = statuses.find((s) => s.key === "ea_sent")?.id ?? NIL_UUID

  // Count in the DB (head:true) so the KPIs stay correct past the 1000-row select cap.
  const [openRes, eaRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("archived", false).in("status_id", openIds),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("archived", false).eq("status_id", eaId),
  ])
  if (openRes.error) throw openRes.error
  if (eaRes.error) throw eaRes.error

  return { openLeads: openRes.count ?? 0, eaOut: eaRes.count ?? 0, assignees, taxonomies, canCreateLead, canManage }
}

export default async function DashboardPage() {
  const { openLeads, eaOut, assignees, taxonomies, canCreateLead, canManage } = await load()
  return (
    <DashboardView
      openLeads={openLeads}
      eaOut={eaOut}
      assignees={assignees}
      taxonomies={taxonomies}
      canCreateLead={canCreateLead}
      canManage={canManage}
    />
  )
}
