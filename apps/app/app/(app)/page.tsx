import { DashboardView, type UpcomingConsultation } from "@/components/dashboard-view"
import { LEADS } from "@/data"
import { getCurrentUser } from "@/lib/auth/session"
import { mapConsultationRow } from "@/lib/consultations/queries"
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
  leadKpisMock: boolean
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  upcomingConsultations: UpcomingConsultation[]
  upcomingCount: number
  canCreateLead: boolean
  canManage: boolean
}

// Real upcoming consultations for the dashboard: the next-5 list + the full upcoming count (for the KPI).
// Bounded in SQL (NOT "load every consult + slice in memory", which PostgREST's row cap would truncate):
// upcoming = non-terminal status AND start_at >= now, ordered soonest-first. RLS scopes to the firm and to
// viewers with consultations.view — without it both queries return empty, so the list is [] and the count 0.
async function loadUpcomingConsultations(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ items: UpcomingConsultation[]; count: number }> {
  const nowIso = new Date().toISOString()
  const TERMINAL = "(completed,canceled,no_show)" // statuses that are never "upcoming"
  const [listRes, countRes] = await Promise.all([
    supabase
      .from("consultations")
      .select("*")
      .eq("archived", false)
      .not("status", "in", TERMINAL)
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(5),
    supabase
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .eq("archived", false)
      .not("status", "in", TERMINAL)
      .gte("start_at", nowIso),
  ])
  if (listRes.error) throw listRes.error
  if (countRes.error) throw countRes.error

  // Resolve names only for the (≤5) rows shown — fetch just their leads + attorneys, not the whole tables.
  const rows = listRes.data ?? []
  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter((x): x is string => x !== null))]
  const attorneyIds = [...new Set(rows.map((r) => r.attorney_id).filter((x): x is string => x !== null))]
  const [leadsRes, profilesRes] = await Promise.all([
    leadIds.length ? supabase.from("leads").select("id, first_name, last_name").in("id", leadIds) : null,
    attorneyIds.length ? supabase.from("profiles").select("id, name").in("id", attorneyIds) : null,
  ])
  if (leadsRes?.error) throw leadsRes.error
  if (profilesRes?.error) throw profilesRes.error

  const leadNames = new Map((leadsRes?.data ?? []).map((l) => [l.id, `${l.first_name} ${l.last_name}`.trim()]))
  const profileNames = new Map((profilesRes?.data ?? []).map((p) => [p.id, p.name]))
  const items = rows.map((r) => {
    const c = mapConsultationRow(r, leadNames, profileNames)
    return {
      id: c.id,
      leadId: c.leadId,
      leadName: c.leadName,
      attorneyName: c.attorneyName,
      status: c.status,
      startAt: c.startAt,
      timeZone: c.timeZone,
    }
  })
  return { items, count: countRes.count ?? 0 }
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
      leadKpisMock: true,
      assignees: [],
      taxonomies: groupTaxonomies([]),
      upcomingConsultations: [],
      upcomingCount: 0,
      canCreateLead: false,
      canManage: false,
    }
  const supabase = await createClient()
  const canCreateLead = me.permissions?.includes("leads.edit") ?? false
  const canManage = me.permissions?.includes("settings.manage") ?? false

  // Assignees, taxonomies, pipeline statuses (per-firm cache), and the real upcoming-consultations list.
  const [staff, taxRows, statuses, upcomingData] = await Promise.all([
    getFirmStaff(me.firmId),
    getFirmTaxonomyRows(me.firmId),
    getFirmStatusRows(me.firmId),
    loadUpcomingConsultations(supabase),
  ])
  const upcomingConsultations = upcomingData.items
  const upcomingCount = upcomingData.count
  const assignees = staff
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name }))
  const taxonomies = groupTaxonomies(taxRows)

  // The lead KPIs need leads.view. For roles without it (QA lead, creative writer, file clerk)
  // keep them on the mock counts like the rest of the dashboard, rather than a misleading 0.
  if (!(me.permissions?.includes("leads.view") ?? false)) {
    return { ...mockLeadCounts(), leadKpisMock: true, assignees, taxonomies, upcomingConsultations, upcomingCount, canCreateLead, canManage }
  }

  const openIds = statuses.filter((s) => !s.is_terminal).map((s) => s.id)
  const eaId = statuses.find((s) => s.key === "ea_sent")?.id ?? NIL_UUID

  // Count in the DB (head:true) so the KPIs stay correct past the 1000-row select cap.
  const [openRes, eaRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("archived", false).in("status_id", openIds),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("archived", false).eq("status_id", eaId),
  ])
  if (openRes.error) throw openRes.error
  if (eaRes.error) throw eaRes.error

  return { openLeads: openRes.count ?? 0, eaOut: eaRes.count ?? 0, leadKpisMock: false, assignees, taxonomies, upcomingConsultations, upcomingCount, canCreateLead, canManage }
}

export default async function DashboardPage() {
  const { openLeads, eaOut, leadKpisMock, assignees, taxonomies, upcomingConsultations, upcomingCount, canCreateLead, canManage } = await load()
  return (
    <DashboardView
      openLeads={openLeads}
      eaOut={eaOut}
      leadKpisMock={leadKpisMock}
      assignees={assignees}
      taxonomies={taxonomies}
      upcomingConsultations={upcomingConsultations}
      upcomingCount={upcomingCount}
      canCreateLead={canCreateLead}
      canManage={canManage}
    />
  )
}
