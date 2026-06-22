import { notFound } from "next/navigation"

import { LeadDetail } from "@/components/leads/lead-detail"
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

type Loaded = {
  lead: LeadView
  statuses: LeadStatusView[]
  assignees: AssigneeOption[]
  canEdit: boolean
}

async function load(id: string): Promise<Loaded | null> {
  if (!isSupabaseConfigured()) {
    const statuses = mockLeadStatuses()
    const byKey = new Map(statuses.map((s) => [s.key, s]))
    const mock = LEADS.find((l) => l.id === id)
    const lead = mock ? mapMockLead(mock, byKey) : null
    if (!lead) return null
    return {
      lead,
      statuses,
      assignees: STAFF.filter((u) => u.role === "sales").map((u) => ({ id: u.id, name: u.name })),
      canEdit: false,
    }
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  const [leadRes, statusesRes, assigneesRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("lead_statuses").select("*").order("position"),
    supabase.from("profiles").select("id, name").eq("status", "active").order("name"),
  ])
  if (leadRes.error) throw leadRes.error
  if (statusesRes.error) throw statusesRes.error
  if (assigneesRes.error) throw assigneesRes.error
  if (!leadRes.data) return null

  const statuses = (statusesRes.data ?? []).map(mapLeadStatus)
  const byId = new Map(statuses.map((s) => [s.id, s]))
  const lead = mapLeadRow(leadRes.data, byId)
  if (!lead) return null

  return {
    lead,
    statuses,
    assignees: (assigneesRes.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    canEdit: me?.permissions?.includes("leads.edit") ?? false,
  }
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await load(id)
  if (!data) notFound()
  return (
    <LeadDetail
      lead={data.lead}
      statuses={data.statuses}
      assignees={data.assignees}
      canEdit={data.canEdit}
    />
  )
}
