import { notFound } from "next/navigation"

import { LeadDetail } from "@/components/leads/lead-detail"
import { getCurrentUser } from "@/lib/auth/session"
import {
  mapLeadRow,
  mapLeadStatus,
  type AssigneeOption,
  type LeadStatusView,
  type LeadView,
} from "@/lib/leads/queries"
import { mapNoteRow, type NoteView } from "@/lib/notes/queries"
import { createClient } from "@/lib/supabase/server"
import { groupTaxonomies, type FirmTaxonomies } from "@/lib/taxonomies/queries"

type Loaded = {
  lead: LeadView
  statuses: LeadStatusView[]
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  notes: NoteView[]
  currentUserId: string | null
  canEdit: boolean
  canManage: boolean
}

async function load(id: string): Promise<Loaded | null> {
  const me = await getCurrentUser()
  const supabase = await createClient()
  const [leadRes, statusesRes, assigneesRes, taxRes, notesRes, namesRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("lead_statuses").select("*").order("position"),
    supabase.from("profiles").select("id, name").eq("status", "active").order("name"),
    supabase.from("firm_taxonomies").select("*").order("position"),
    supabase
      .from("notes")
      .select("*")
      .eq("entity_type", "lead")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name"),
  ])
  if (leadRes.error) throw leadRes.error
  if (statusesRes.error) throw statusesRes.error
  if (assigneesRes.error) throw assigneesRes.error
  if (taxRes.error) throw taxRes.error
  if (notesRes.error) throw notesRes.error
  if (namesRes.error) throw namesRes.error
  if (!leadRes.data) return null

  const statuses = (statusesRes.data ?? []).map(mapLeadStatus)
  const byId = new Map(statuses.map((s) => [s.id, s]))
  const lead = mapLeadRow(leadRes.data, byId)
  if (!lead) return null
  const namesById = new Map((namesRes.data ?? []).map((p) => [p.id, p.name]))

  return {
    lead,
    statuses,
    assignees: (assigneesRes.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    taxonomies: groupTaxonomies(taxRes.data ?? []),
    notes: (notesRes.data ?? []).map((r) => mapNoteRow(r, namesById)),
    currentUserId: me?.id ?? null,
    canEdit: me?.permissions?.includes("leads.edit") ?? false,
    canManage: me?.permissions?.includes("settings.manage") ?? false,
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
      taxonomies={data.taxonomies}
      notes={data.notes}
      currentUserId={data.currentUserId}
      canEdit={data.canEdit}
      canManage={data.canManage}
    />
  )
}
