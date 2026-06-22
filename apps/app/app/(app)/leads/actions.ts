"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { buildLeadData, mergeLeadData, type LeadDataInput, type LeadVocab } from "@/lib/leads/data-schema"
import { parseLeadInput } from "@/lib/leads/validation"
import { createClient } from "@/lib/supabase/server"
import { groupTaxonomies, toLeadVocab } from "@/lib/taxonomies/queries"

export type ActionResult = { ok: true } | { error: string }

const LEADS_PATH = "/leads"

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }
type LeadsClient = Awaited<ReturnType<typeof createClient>>

// Leads writes require leads.edit. RLS is the real enforcement; this returns a clean error first.
async function requireLeadsEdit(): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!(user.permissions?.includes("leads.edit") ?? false))
    return { ok: false, error: "You don't have permission to manage leads." }
  return { ok: true, user }
}

// Best-effort — an audit failure (incl. a thrown network/timeout error) must not fail the
// user's action.
async function audit(supabase: LeadsClient, byUserId: string, leadId: string, label: string, action: string) {
  try {
    const { error } = await supabase
      .from("audit_log")
      .insert({ entity: "lead", entity_id: leadId, label, action, by_user_id: byUserId })
    // Best-effort: surface a returned error (RLS/constraint) in logs for visibility, but never
    // block the user's action on it.
    if (error) console.error("audit_log insert failed:", error.message)
  } catch (err) {
    console.error("audit_log insert threw:", err)
  }
}

// Lead mutations also shift the dashboard's lead KPIs (/), so revalidate it alongside.
function revalidateLeads(id?: string) {
  revalidatePath(LEADS_PATH)
  revalidatePath("/")
  if (id) revalidatePath(`/leads/${id}`)
}

function readDataFields(formData: FormData): LeadDataInput {
  const get = (k: string) => {
    const v = formData.get(k)
    return typeof v === "string" ? v : undefined
  }
  return {
    caseType: get("caseType"),
    hierarchy: get("hierarchy"),
    qualification: get("qualification"),
    preferredLanguage: get("preferredLanguage"),
    countryOfOrigin: get("countryOfOrigin"),
    city: get("city"),
    state: get("state"),
    zip: get("zip"),
    gender: get("gender"),
    dob: get("dob"),
    referralSource: get("referralSource"),
  }
}

function readCore(formData: FormData) {
  return parseLeadInput({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    source: formData.get("source"),
    assignedToId: formData.get("assignedToId"),
    notes: formData.get("notes"),
  })
}

// The firm's active taxonomy labels, for buildLeadData validation (case type / hierarchy /
// qualification are firm-defined now). RLS scopes the read to the firm.
async function loadVocab(supabase: LeadsClient): Promise<LeadVocab> {
  const { data } = await supabase.from("firm_taxonomies").select("*").order("position")
  return toLeadVocab(groupTaxonomies(data ?? []))
}

export async function createLead(formData: FormData): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readCore(formData)
  if (!core.ok) return { error: core.error }

  const supabase = await createClient()
  const data = buildLeadData(readDataFields(formData), await loadVocab(supabase))
  if (!data.ok) return { error: data.error }

  // New leads land in the firm's first open stage (lowest position, non-terminal).
  const { data: stage, error: stageErr } = await supabase
    .from("lead_statuses")
    .select("id")
    .eq("is_terminal", false)
    .order("position")
    .limit(1)
    .maybeSingle()
  if (stageErr) return { error: "Couldn't load the pipeline stages." }
  if (!stage) return { error: "No open pipeline stage is configured." }

  // firm_id defaults to current_firm_id(); status_id is from this firm, so the composite FK holds.
  const { data: inserted, error } = await supabase
    .from("leads")
    .insert({
      first_name: core.value.firstName,
      last_name: core.value.lastName,
      phone: core.value.phone,
      email: core.value.email,
      source: core.value.source,
      assigned_to_id: core.value.assignedToId,
      notes: core.value.notes || null,
      status_id: stage.id,
      data: data.value,
    })
    .select("id")
    .single()
  if (error || !inserted) return { error: "Couldn't create the lead." }

  await audit(supabase, gate.user.id, inserted.id, `${core.value.firstName} ${core.value.lastName}`, "created")
  revalidateLeads()
  return { ok: true }
}

export async function updateLead(id: string, formData: FormData): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readCore(formData)
  if (!core.ok) return { error: core.error }

  const supabase = await createClient()
  const data = buildLeadData(readDataFields(formData), await loadVocab(supabase))
  if (!data.ok) return { error: data.error }

  // Preserve jsonb keys the form doesn't manage (e.g. ingestion payload) — merge, not replace.
  const { data: existing, error: readErr } = await supabase
    .from("leads")
    .select("data")
    .eq("id", id)
    .single()
  if (readErr || !existing) return { error: "Couldn't update the lead." }

  // .select().single() makes a 0-row update (RLS / wrong id) a real error, not a silent ok.
  const { data: updated, error } = await supabase
    .from("leads")
    .update({
      first_name: core.value.firstName,
      last_name: core.value.lastName,
      phone: core.value.phone,
      email: core.value.email,
      source: core.value.source,
      assigned_to_id: core.value.assignedToId,
      notes: core.value.notes || null,
      data: mergeLeadData(existing.data, data.value),
      last_activity: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't update the lead." }

  await audit(supabase, gate.user.id, id, `${core.value.firstName} ${core.value.lastName}`, "updated")
  revalidateLeads(id)
  return { ok: true }
}

// Inline pipeline move. The composite FK rejects a status from another firm.
export async function setLeadStatus(id: string, statusId: string): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }
  if (!statusId) return { error: "Choose a status." }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from("leads")
    .update({ status_id: statusId, last_activity: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't update the status." }

  revalidateLeads(id)
  return { ok: true }
}

export async function assignLead(id: string, assigneeId: string): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from("leads")
    .update({ assigned_to_id: assigneeId || null, last_activity: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't reassign the lead." }

  revalidateLeads(id)
  return { ok: true }
}

export async function setLeadArchived(
  id: string,
  archived: boolean,
  label: string,
): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from("leads")
    .update({ archived })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't archive the lead." }

  await audit(supabase, gate.user.id, id, label, archived ? "archived" : "unarchived")
  revalidateLeads(id)
  return { ok: true }
}
