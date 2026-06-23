"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import {
  buildLeadData,
  mergeLeadData,
  parseLeadData,
  type LeadData,
  type LeadDataInput,
  type LeadVocab,
} from "@/lib/leads/data-schema"
import { parseLeadInput } from "@/lib/leads/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/supabase/database.types"
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
async function audit(
  supabase: LeadsClient,
  byUserId: string,
  leadId: string,
  label: string,
  action: string
) {
  try {
    const { error } = await supabase.from("audit_log").insert({
      entity: "lead",
      entity_id: leadId,
      label,
      action,
      by_user_id: byUserId,
    })
    // Best-effort: surface a returned error (RLS/constraint) in logs for visibility, but never
    // block the user's action on it.
    if (error) console.error("audit_log insert failed:", error.message)
  } catch (err) {
    console.error("audit_log insert threw:", err)
  }
}

// Record a read-only lifecycle event on the lead's activity timeline (a kind='event' note row).
// Best-effort — a failed event log must never fail the underlying action.
async function recordEvent(
  firmId: string,
  leadId: string,
  body: string,
  byUserId: string
) {
  // kind='event' is blocked for authenticated users by guard_notes, so events are written via the
  // service-role admin client — which bypasses RLS, so firm_id must be set explicitly.
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("notes").insert({
      firm_id: firmId,
      entity_type: "lead",
      entity_id: leadId,
      kind: "event",
      body,
      created_by_id: byUserId,
    })
    if (error) console.error("note event insert failed:", error.message)
  } catch (err) {
    console.error("note event insert threw:", err)
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
  })
}

// The firm's active taxonomy labels, for buildLeadData validation (case type / hierarchy /
// qualification are firm-defined now). RLS scopes the read to the firm.
async function loadVocab(supabase: LeadsClient): Promise<LeadVocab> {
  const { data, error } = await supabase
    .from("firm_taxonomies")
    .select("*")
    .order("position")
  if (error) throw error
  return toLeadVocab(groupTaxonomies(data ?? []))
}

// Let a lead keep a value that's since been deactivated/renamed: its current taxonomy values stay
// valid on update even if no longer in the active vocab (the form resubmits them via hidden inputs).
function withExistingValues(vocab: LeadVocab, existing: LeadData): LeadVocab {
  return {
    caseType: existing.caseType
      ? [...vocab.caseType, existing.caseType]
      : vocab.caseType,
    hierarchy: existing.hierarchy
      ? [...vocab.hierarchy, existing.hierarchy]
      : vocab.hierarchy,
    qualification: existing.qualification
      ? [...vocab.qualification, existing.qualification]
      : vocab.qualification,
  }
}

export async function createLead(formData: FormData): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readCore(formData)
  if (!core.ok) return { error: core.error }

  const supabase = await createClient()
  let vocab: LeadVocab
  try {
    vocab = await loadVocab(supabase)
  } catch {
    return { error: "Couldn't load the firm's case types. Try again." }
  }
  const data = buildLeadData(readDataFields(formData), vocab)
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
      status_id: stage.id,
      data: data.value,
    })
    .select("id")
    .single()
  if (error || !inserted) return { error: "Couldn't create the lead." }

  await audit(
    supabase,
    gate.user.id,
    inserted.id,
    `${core.value.firstName} ${core.value.lastName}`,
    "created"
  )
  revalidateLeads()
  return { ok: true }
}

export async function updateLead(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readCore(formData)
  if (!core.ok) return { error: core.error }

  const supabase = await createClient()
  // Read existing first: for the jsonb merge below, the assignee/qualification event diff, and so an
  // unchanged deactivated/legacy taxonomy value still validates (the form resubmits current values).
  const { data: existing, error: readErr } = await supabase
    .from("leads")
    .select("data, assigned_to_id")
    .eq("id", id)
    .single()
  if (readErr || !existing) return { error: "Couldn't update the lead." }

  let vocab: LeadVocab
  try {
    vocab = await loadVocab(supabase)
  } catch {
    return { error: "Couldn't load the firm's case types. Try again." }
  }
  const data = buildLeadData(
    readDataFields(formData),
    withExistingValues(vocab, parseLeadData(existing.data))
  )
  if (!data.ok) return { error: data.error }

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
      data: mergeLeadData(existing.data, data.value),
      last_activity: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't update the lead." }

  await audit(
    supabase,
    gate.user.id,
    id,
    `${core.value.firstName} ${core.value.lastName}`,
    "updated"
  )
  // Mirror the inline controls' timeline events for the fields the dialog can also change.
  if (existing.assigned_to_id !== core.value.assignedToId) {
    let body = "Unassigned the lead"
    if (core.value.assignedToId) {
      const { data: assignee } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", core.value.assignedToId)
        .maybeSingle()
      body = `Assigned to ${assignee?.name ?? "a teammate"}`
    }
    await recordEvent(gate.user.firmId, id, body, gate.user.id)
  }
  const oldQual = parseLeadData(existing.data).qualification ?? ""
  const newQual = data.value.qualification ?? ""
  if (oldQual !== newQual) {
    await recordEvent(
      gate.user.firmId,
      id,
      newQual ? `Qualification → ${newQual}` : "Qualification cleared",
      gate.user.id
    )
  }
  revalidateLeads(id)
  return { ok: true }
}

// Inline pipeline move. The composite FK rejects a status from another firm.
export async function setLeadStatus(
  id: string,
  statusId: string
): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }
  if (!statusId) return { error: "Choose a status." }

  const supabase = await createClient()
  // Skip a no-op move (and its duplicate timeline event) — only act on an actual change.
  const { data: current, error: readErr } = await supabase
    .from("leads")
    .select("status_id")
    .eq("id", id)
    .single()
  if (readErr || !current) return { error: "Couldn't update the status." }
  if (current.status_id === statusId) return { ok: true }

  const { data: updated, error } = await supabase
    .from("leads")
    .update({ status_id: statusId, last_activity: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't update the status." }

  const { data: status } = await supabase
    .from("lead_statuses")
    .select("name")
    .eq("id", statusId)
    .maybeSingle()
  await recordEvent(
    gate.user.firmId,
    id,
    `Moved to ${status?.name ?? "a new status"}`,
    gate.user.id
  )
  revalidateLeads(id)
  return { ok: true }
}

export async function assignLead(
  id: string,
  assigneeId: string
): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const next = assigneeId || null
  // Skip a no-op reassignment (and its duplicate timeline event).
  const { data: current, error: readErr } = await supabase
    .from("leads")
    .select("assigned_to_id")
    .eq("id", id)
    .single()
  if (readErr || !current) return { error: "Couldn't reassign the lead." }
  if (current.assigned_to_id === next) return { ok: true }

  const { data: updated, error } = await supabase
    .from("leads")
    .update({
      assigned_to_id: next,
      last_activity: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't reassign the lead." }

  let body = "Unassigned the lead"
  if (next) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", next)
      .maybeSingle()
    body = `Assigned to ${assignee?.name ?? "a teammate"}`
  }
  await recordEvent(gate.user.firmId, id, body, gate.user.id)
  revalidateLeads(id)
  return { ok: true }
}

// Inline qualification change (a triage decision, stored in the lead's data jsonb).
export async function setLeadQualification(
  id: string,
  value: string
): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: existing, error: readErr } = await supabase
    .from("leads")
    .select("data")
    .eq("id", id)
    .single()
  if (readErr || !existing) return { error: "Couldn't update the lead." }

  const raw =
    existing.data &&
    typeof existing.data === "object" &&
    !Array.isArray(existing.data)
      ? (existing.data as Record<string, Json>)
      : {}
  const currentQual =
    typeof raw.qualification === "string" ? raw.qualification : ""
  const next = value.trim()
  if (currentQual === next) return { ok: true }

  // Atomic single-key write: jsonb_set (in the RPC) touches only data->qualification, so a concurrent
  // edit to another data key can't be lost. Validation + the firm scope live in the RPC, which runs
  // SECURITY INVOKER so the leads RLS (firm + leads.edit) still applies.
  const { data: updatedId, error } = await supabase.rpc(
    "set_lead_qualification",
    { p_id: id, p_value: next }
  )
  if (error)
    return {
      error: error.message.includes("not available")
        ? "That qualification isn't available."
        : "Couldn't update the qualification.",
    }
  // null = no row matched (wrong id or RLS) — don't claim success or log a phantom event.
  if (!updatedId) return { error: "Couldn't update the qualification." }

  await recordEvent(
    gate.user.firmId,
    id,
    next ? `Qualification → ${next}` : "Qualification cleared",
    gate.user.id
  )
  revalidateLeads(id)
  return { ok: true }
}

export async function setLeadArchived(
  id: string,
  archived: boolean,
  label: string
): Promise<ActionResult> {
  const gate = await requireLeadsEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  // Skip a no-op archive/restore (and its duplicate timeline event).
  const { data: current, error: readErr } = await supabase
    .from("leads")
    .select("archived")
    .eq("id", id)
    .single()
  if (readErr || !current) return { error: "Couldn't archive the lead." }
  if (current.archived === archived) return { ok: true }

  const { data: updated, error } = await supabase
    .from("leads")
    .update({ archived })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't archive the lead." }

  await audit(
    supabase,
    gate.user.id,
    id,
    label,
    archived ? "archived" : "unarchived"
  )
  await recordEvent(
    gate.user.firmId,
    id,
    archived ? "Archived the lead" : "Restored the lead",
    gate.user.id
  )
  revalidateLeads(id)
  return { ok: true }
}
