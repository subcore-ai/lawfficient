"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { buildLeadData, type LeadDataInput } from "@/lib/leads/data-schema"
import { parseLeadInput } from "@/lib/leads/validation"
import { createClient } from "@/lib/supabase/server"

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

// Best-effort — an audit failure must not fail the user's action.
async function audit(supabase: LeadsClient, byUserId: string, leadId: string, label: string, action: string) {
  await supabase
    .from("audit_log")
    .insert({ entity: "lead", entity_id: leadId, label, action, by_user_id: byUserId })
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

export async function createLead(formData: FormData): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readCore(formData)
  if (!core.ok) return { error: core.error }
  const data = buildLeadData(readDataFields(formData))
  if (!data.ok) return { error: data.error }

  const supabase = await createClient()

  // New leads land in the firm's first open stage (lowest position, non-terminal).
  const { data: stage } = await supabase
    .from("lead_statuses")
    .select("id")
    .eq("is_terminal", false)
    .order("position")
    .limit(1)
    .maybeSingle()
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
  revalidatePath(LEADS_PATH)
  return { ok: true }
}

export async function updateLead(id: string, formData: FormData): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readCore(formData)
  if (!core.ok) return { error: core.error }
  const data = buildLeadData(readDataFields(formData))
  if (!data.ok) return { error: data.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from("leads")
    .update({
      first_name: core.value.firstName,
      last_name: core.value.lastName,
      phone: core.value.phone,
      email: core.value.email,
      source: core.value.source,
      assigned_to_id: core.value.assignedToId,
      notes: core.value.notes || null,
      data: data.value,
      last_activity: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) return { error: "Couldn't update the lead." }

  await audit(supabase, gate.user.id, id, `${core.value.firstName} ${core.value.lastName}`, "updated")
  revalidatePath(LEADS_PATH)
  revalidatePath(`/leads/${id}`)
  return { ok: true }
}

// Inline pipeline move. The composite FK rejects a status from another firm.
export async function setLeadStatus(id: string, statusId: string): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }
  if (!statusId) return { error: "Choose a status." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("leads")
    .update({ status_id: statusId, last_activity: new Date().toISOString() })
    .eq("id", id)
  if (error) return { error: "Couldn't update the status." }

  revalidatePath(LEADS_PATH)
  revalidatePath(`/leads/${id}`)
  return { ok: true }
}

export async function assignLead(id: string, assigneeId: string): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from("leads")
    .update({ assigned_to_id: assigneeId || null, last_activity: new Date().toISOString() })
    .eq("id", id)
  if (error) return { error: "Couldn't reassign the lead." }

  revalidatePath(LEADS_PATH)
  revalidatePath(`/leads/${id}`)
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
  const { error } = await supabase.from("leads").update({ archived }).eq("id", id)
  if (error) return { error: "Couldn't archive the lead." }

  await audit(supabase, gate.user.id, id, label, archived ? "archived" : "unarchived")
  revalidatePath(LEADS_PATH)
  revalidatePath(`/leads/${id}`)
  return { ok: true }
}
