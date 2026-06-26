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
import { mapConsultationRow, partitionConsultations, type ConsultationView } from "@/lib/consultations/queries"
import {
  getFirmStaff,
  getFirmStatusRows,
  getFirmTaxonomyRows,
} from "@/lib/reference"
import { createClient } from "@/lib/supabase/server"
import { groupTaxonomies, type FirmTaxonomies } from "@/lib/taxonomies/queries"

type Loaded = {
  lead: LeadView
  statuses: LeadStatusView[]
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  notes: NoteView[]
  currentUserId: string | null
  currentUserName: string | null
  canEdit: boolean
  canManage: boolean
  consultations: ConsultationView[]
  canViewConsultations: boolean
  canManageConsultations: boolean
  consultDefaultTimeZone: string | null
}

async function load(id: string): Promise<Loaded | null> {
  const me = await getCurrentUser()
  if (!me) return null
  const supabase = await createClient()
  // Lead + notes are per-record → RLS client. Statuses / taxonomies / staff are firm reference data
  // → per-firm cache (lib/reference.ts). All five still resolve in parallel.
  const [leadRes, notesRes, consultRes, firmRes, statusRows, taxRows, staff] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("notes")
      .select("*")
      .eq("entity_type", "lead")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    // The lead's own consultations (partitionConsultations orders them below, so no SQL order needed).
    // RLS scopes to consultations.view, so a user without it gets an empty list (the card is hidden too).
    supabase.from("consultations").select("*").eq("lead_id", id),
    supabase.from("firms").select("timezone").maybeSingle(),
    getFirmStatusRows(me.firmId),
    getFirmTaxonomyRows(me.firmId),
    getFirmStaff(me.firmId),
  ])
  if (leadRes.error) throw leadRes.error
  if (notesRes.error) throw notesRes.error
  if (consultRes.error) throw consultRes.error
  if (!leadRes.data) return null

  const statuses = statusRows.map(mapLeadStatus)
  const byId = new Map(statuses.map((s) => [s.id, s]))
  const lead = mapLeadRow(leadRes.data, byId)
  if (!lead) return null
  const namesById = new Map(staff.map((p) => [p.id, p.name]))
  // This lead's own name resolves the consultation rows (they all point back to it). Order them like
  // the consultations page does — soonest upcoming first, then past — not raw start_at desc (which would
  // surface a far-future or terminal consult above the nearest active one).
  const leadNames = new Map([[lead.id, `${lead.firstName} ${lead.lastName}`.trim()]])
  const consultViews = (consultRes.data ?? []).map((r) => mapConsultationRow(r, leadNames, namesById))
  const { upcoming, past } = partitionConsultations(consultViews, new Date().toISOString())
  const consultations = [...upcoming, ...past]

  return {
    lead,
    statuses,
    assignees: staff
      .filter((p) => p.status === "active")
      .map((p) => ({ id: p.id, name: p.name })),
    taxonomies: groupTaxonomies(taxRows),
    notes: (notesRes.data ?? []).map((r) => mapNoteRow(r, namesById)),
    currentUserId: me.id,
    currentUserName: me.name,
    canEdit: me.permissions?.includes("leads.edit") ?? false,
    canManage: me.permissions?.includes("settings.manage") ?? false,
    consultations,
    canViewConsultations: me.permissions?.includes("consultations.view") ?? false,
    canManageConsultations: me.permissions?.includes("consultations.edit") ?? false,
    // Best-effort: a firm-read failure just falls back to the dialog's own default zone.
    consultDefaultTimeZone: firmRes.data?.timezone ?? null,
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
      currentUserName={data.currentUserName}
      canEdit={data.canEdit}
      canManage={data.canManage}
      consultations={data.consultations}
      canViewConsultations={data.canViewConsultations}
      canManageConsultations={data.canManageConsultations}
      consultDefaultTimeZone={data.consultDefaultTimeZone}
    />
  )
}
