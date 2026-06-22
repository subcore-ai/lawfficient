import { DashboardView } from "@/components/dashboard-view"
import { LEADS, STAFF } from "@/data"
import { getCurrentUser } from "@/lib/auth/session"
import type { AssigneeOption } from "@/lib/leads/queries"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Dashboard" }

type Loaded = {
  openLeads: number
  eaOut: number
  assignees: AssigneeOption[]
  canCreateLead: boolean
}

// The two lead KPIs come from real counts; the rest of the dashboard stays on the mock store.
async function load(): Promise<Loaded> {
  if (!isSupabaseConfigured()) {
    const terminal = ["retained", "lost", "not_qualified"]
    return {
      openLeads: LEADS.filter((l) => !l.archived && !terminal.includes(l.status)).length,
      eaOut: LEADS.filter((l) => !l.archived && l.status === "ea_sent").length,
      assignees: STAFF.filter((u) => u.role === "sales").map((u) => ({ id: u.id, name: u.name })),
      canCreateLead: false,
    }
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  const [statusesRes, leadsRes, assigneesRes] = await Promise.all([
    supabase.from("lead_statuses").select("id, key, is_terminal"),
    supabase.from("leads").select("status_id, archived"),
    supabase.from("profiles").select("id, name").eq("status", "active").order("name"),
  ])
  if (statusesRes.error) throw statusesRes.error
  if (leadsRes.error) throw leadsRes.error
  if (assigneesRes.error) throw assigneesRes.error

  const statuses = statusesRes.data ?? []
  const terminal = new Set(statuses.filter((s) => s.is_terminal).map((s) => s.id))
  const eaId = statuses.find((s) => s.key === "ea_sent")?.id ?? null
  const leads = leadsRes.data ?? []

  return {
    openLeads: leads.filter((l) => !l.archived && !terminal.has(l.status_id)).length,
    eaOut: leads.filter((l) => !l.archived && l.status_id === eaId).length,
    assignees: (assigneesRes.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    canCreateLead: me?.permissions?.includes("leads.edit") ?? false,
  }
}

export default async function DashboardPage() {
  const { openLeads, eaOut, assignees, canCreateLead } = await load()
  return (
    <DashboardView openLeads={openLeads} eaOut={eaOut} assignees={assignees} canCreateLead={canCreateLead} />
  )
}
