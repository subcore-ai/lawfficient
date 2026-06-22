import { DashboardView } from "@/components/dashboard-view"
import { LEADS, STAFF } from "@/data"
import { getCurrentUser } from "@/lib/auth/session"
import type { AssigneeOption } from "@/lib/leads/queries"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Dashboard" }

const NIL_UUID = "00000000-0000-0000-0000-000000000000"

type Loaded = {
  openLeads: number
  eaOut: number
  assignees: AssigneeOption[]
  canCreateLead: boolean
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
  if (!isSupabaseConfigured()) {
    return {
      ...mockLeadCounts(),
      assignees: STAFF.filter((u) => u.role === "sales").map((u) => ({ id: u.id, name: u.name })),
      canCreateLead: false,
    }
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  const canCreateLead = me?.permissions?.includes("leads.edit") ?? false

  const assigneesRes = await supabase.from("profiles").select("id, name").eq("status", "active").order("name")
  if (assigneesRes.error) throw assigneesRes.error
  const assignees = (assigneesRes.data ?? []).map((p) => ({ id: p.id, name: p.name }))

  // The lead KPIs need leads.view. For roles without it (QA lead, creative writer, file clerk)
  // keep them on the mock counts like the rest of the dashboard, rather than a misleading 0.
  if (!(me?.permissions?.includes("leads.view") ?? false)) {
    return { ...mockLeadCounts(), assignees, canCreateLead }
  }

  const statusesRes = await supabase.from("lead_statuses").select("id, key, is_terminal")
  if (statusesRes.error) throw statusesRes.error
  const statuses = statusesRes.data ?? []
  const openIds = statuses.filter((s) => !s.is_terminal).map((s) => s.id)
  const eaId = statuses.find((s) => s.key === "ea_sent")?.id ?? NIL_UUID

  // Count in the DB (head:true) so the KPIs stay correct past the 1000-row select cap.
  const [openRes, eaRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("archived", false).in("status_id", openIds),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("archived", false).eq("status_id", eaId),
  ])
  if (openRes.error) throw openRes.error
  if (eaRes.error) throw eaRes.error

  return { openLeads: openRes.count ?? 0, eaOut: eaRes.count ?? 0, assignees, canCreateLead }
}

export default async function DashboardPage() {
  const { openLeads, eaOut, assignees, canCreateLead } = await load()
  return (
    <DashboardView openLeads={openLeads} eaOut={eaOut} assignees={assignees} canCreateLead={canCreateLead} />
  )
}
