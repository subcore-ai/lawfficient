"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { mapConsultationTypeRow, type ConsultationType } from "@/lib/consultations/consultation-types"
import { formatConsultationWhen, zonedWallTimeToUtcISO } from "@/lib/consultations/time"
import { parseConsultationInput, type ConsultationStatus } from "@/lib/consultations/validation"
import { recordLeadEvent } from "@/lib/leads/events"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }

const PATH = "/consultations"

// The lifecycle moves this action represents (cancel / complete / mark no-show). Scheduling states
// (`scheduled`/`paid`/`rescheduled`) are reached via create + reschedule, not here.
const STATUS_TRANSITIONS: ConsultationStatus[] = ["completed", "no_show", "canceled"]

// Timeline wording for each terminal transition (recorded on the consult's lead).
const STATUS_EVENT: Record<string, string> = {
  completed: "Consultation completed",
  no_show: "Consultation marked no-show",
  canceled: "Consultation canceled",
}

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }
type DbClient = Awaited<ReturnType<typeof createClient>>

async function requireConsultEdit(): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!(user.permissions?.includes("consultations.edit") ?? false))
    return { ok: false, error: "You don't have permission to manage consultations." }
  return { ok: true, user }
}

async function audit(supabase: DbClient, byUserId: string, id: string, label: string, action: string) {
  try {
    const { error } = await supabase
      .from("audit_log")
      .insert({ entity: "consultation", entity_id: id, label, action, by_user_id: byUserId })
    if (error) console.error("audit_log insert failed:", error.message)
  } catch (err) {
    console.error("audit_log insert threw:", err)
  }
}

// Consultation counts feed the dashboard (/), so revalidate it alongside the list. The consult's lead
// page (its consultations card + activity timeline) is revalidated too when a lead is involved.
function revalidate(leadId?: string | null) {
  revalidatePath(PATH)
  revalidatePath("/")
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

function readInput(formData: FormData) {
  return parseConsultationInput({
    leadId: formData.get("leadId"),
    attorneyId: formData.get("attorneyId"),
    type: formData.get("type"),
    startAt: formData.get("startAt"),
    durationMin: formData.get("durationMin"),
    timeZone: formData.get("timeZone"),
    paid: formData.get("paid"),
    amount: formData.get("amount"),
  })
}

// A click-booked calendar slot carries its exact UTC instant (`startAtIso`) — prefer it over re-deriving
// from the naive wall string, which is ambiguous on the DST fall-back hour (one wall time maps to two
// instants). A hand-typed/edited time sends no `startAtIso` and falls back to wall + zone.
function resolveStartAt(formData: FormData, wall: string, timeZone: string): string | null {
  const iso = formData.get("startAtIso")
  if (typeof iso === "string" && iso !== "") {
    const ms = Date.parse(iso)
    if (Number.isFinite(ms)) return new Date(ms).toISOString()
  }
  return zonedWallTimeToUtcISO(wall, timeZone)
}

// The current values of an editable consult, plus the lead's name for display (the lead itself is fixed).
export type ConsultationEditData = {
  id: string
  leadId: string
  leadName: string
  type: string
  attorneyId: string | null
  startAtIso: string
  durationMin: number
  timeZone: string
  amount: number | null
  paid: boolean
}

export type LoadConsultationForEdit =
  | { ok: true; consult: ConsultationEditData; attorneys: { id: string; name: string }[]; consultationTypes: ConsultationType[] }
  | { ok: false; error: string }

// Everything the edit dialog needs in one round-trip, so it can be opened from anywhere (calendar, board,
// lead page) with just the consult id — no threading the attorney/type lists or the consult's fields
// through every view. RLS scopes all reads to the firm. A finalized consult can't be edited.
export async function loadConsultationForEdit(id: string): Promise<LoadConsultationForEdit> {
  const gate = await requireConsultEdit()
  if (!gate.ok) return { ok: false, error: gate.error }

  const supabase = await createClient()
  // Load the consult first — we need its attorney_id to also fetch that attorney even if deactivated.
  const { data: c, error: consultErr } = await supabase
    .from("consultations")
    .select("id, lead_id, attorney_id, type, start_at, duration_min, time_zone, amount, paid, status")
    .eq("id", id)
    .single()
  if (consultErr || !c) return { ok: false, error: "Couldn't load the consultation." }
  if (c.status === "completed" || c.status === "canceled" || c.status === "no_show") {
    return { ok: false, error: "This consultation is finalized and can't be edited." }
  }

  // lead_id is nullable in the schema (a deleted lead orphans the consult); coerce so the form's leadId
  // stays a string. An empty leadId just yields no lead name — a rare orphaned-consult edge.
  const leadId = c.lead_id ?? ""
  // Include the consult's current attorney even if since deactivated, so the edit form keeps + displays it.
  const profileFilter = c.attorney_id ? `status.eq.active,id.eq.${c.attorney_id}` : "status.eq.active"
  const [staffRes, typesRes, leadRes] = await Promise.all([
    supabase.from("profiles").select("id, name").or(profileFilter).order("name"),
    supabase.from("consultation_types").select("*").eq("is_active", true).order("position").order("created_at"),
    supabase.from("leads").select("first_name, last_name").eq("id", leadId).maybeSingle(),
  ])
  // Don't mask a failed picker-list load as empty options — surface it so the edit UI isn't silently broken.
  if (staffRes.error || typesRes.error) return { ok: false, error: "Couldn't load the consultation." }
  const lead = leadRes.data

  return {
    ok: true,
    consult: {
      id: c.id,
      leadId,
      leadName: lead ? `${lead.first_name} ${lead.last_name}`.trim() : "—",
      type: c.type,
      attorneyId: c.attorney_id,
      startAtIso: c.start_at,
      durationMin: c.duration_min,
      timeZone: c.time_zone,
      amount: c.amount,
      paid: c.paid,
    },
    attorneys: (staffRes.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    consultationTypes: typesRes.error ? [] : (typesRes.data ?? []).map(mapConsultationTypeRow),
  }
}

export async function createConsultation(formData: FormData): Promise<ActionResult> {
  const gate = await requireConsultEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readInput(formData)
  if (!core.ok) return { error: core.error }

  const startAt = resolveStartAt(formData, core.value.startAt, core.value.timeZone)
  if (!startAt) return { error: "Couldn't read the date/time for that time zone." }

  const supabase = await createClient()
  // firm_id defaults to current_firm_id(); the composite FKs reject a lead/attorney from another firm.
  // `paid` + `amount` track payment INDEPENDENTLY of the lifecycle `status`, so a booking always starts
  // "scheduled" (the card shows payment separately) — nothing to keep in sync on later edits.
  const { data: inserted, error } = await supabase
    .from("consultations")
    .insert({
      lead_id: core.value.leadId,
      attorney_id: core.value.attorneyId,
      type: core.value.type,
      start_at: startAt,
      duration_min: core.value.durationMin,
      time_zone: core.value.timeZone,
      paid: core.value.paid,
      amount: core.value.amount,
      status: "scheduled",
      booked_by_id: gate.user.id,
    })
    .select("id")
    .single()
  if (error?.code === "23503") return { error: "That lead or attorney isn't in your firm." }
  if (error?.code === "23P01") return { error: "That attorney already has a consultation at that time." }
  if (error || !inserted) return { error: "Couldn't book the consultation." }

  await audit(supabase, gate.user.id, inserted.id, core.value.type, "created")
  await recordLeadEvent(
    core.value.leadId,
    `Consultation booked — ${core.value.type}, ${formatConsultationWhen(startAt, core.value.timeZone)}`,
  )
  revalidate(core.value.leadId)
  return { ok: true }
}

export async function updateConsultation(id: string, formData: FormData): Promise<ActionResult> {
  const gate = await requireConsultEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readInput(formData)
  if (!core.ok) return { error: core.error }

  const startAt = zonedWallTimeToUtcISO(core.value.startAt, core.value.timeZone)
  if (!startAt) return { error: "Couldn't read the date/time for that time zone." }

  const supabase = await createClient()
  // A single atomic write — only for a NON-terminal consult (a finalized one can't be edited, consistent
  // with reschedule / setStatus). The `.in()` is the atomic guard. `status` is NOT touched here (it's
  // owned by reschedule / setStatus and is independent of `paid`), so there's no second write to diverge.
  const { data: updated, error } = await supabase
    .from("consultations")
    .update({
      attorney_id: core.value.attorneyId,
      type: core.value.type,
      start_at: startAt,
      duration_min: core.value.durationMin,
      time_zone: core.value.timeZone,
      paid: core.value.paid,
      amount: core.value.amount,
      last_activity: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["scheduled", "paid", "rescheduled"])
    .select("id, lead_id")
    .maybeSingle()
  if (error?.code === "23503") return { error: "That attorney isn't in your firm." }
  if (error?.code === "23P01") return { error: "That attorney already has a consultation at that time." }
  if (error) return { error: "Couldn't update the consultation." }
  if (!updated) return { error: "This consultation is finalized and can't be edited." }

  await audit(supabase, gate.user.id, id, core.value.type, "updated")
  await recordLeadEvent(updated.lead_id, `Consultation updated — ${core.value.type}`)
  revalidate(updated.lead_id)
  return { ok: true }
}

// Cancel / complete / mark no-show — the only transitions this action represents.
export async function setConsultationStatus(id: string, status: string): Promise<ActionResult> {
  const gate = await requireConsultEdit()
  if (!gate.ok) return { error: gate.error }
  if (!STATUS_TRANSITIONS.includes(status as ConsultationStatus)) return { error: "Unsupported status change." }

  const supabase = await createClient()
  // Transition only FROM a non-terminal state — the `.in()` filter is the atomic guard, so an
  // already-finalized consult (completed / canceled / no-show) can't be overwritten.
  const { data: updated, error } = await supabase
    .from("consultations")
    .update({ status: status as ConsultationStatus, last_activity: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "paid", "rescheduled"])
    .select("id, lead_id")
    .maybeSingle()
  if (error) return { error: "Couldn't update the consultation." }
  if (!updated) return { error: "This consultation is already finalized." }

  await audit(supabase, gate.user.id, id, status, "status_changed")
  await recordLeadEvent(updated.lead_id, STATUS_EVENT[status] ?? "Consultation updated")
  revalidate(updated.lead_id)
  return { ok: true }
}

// Record the post-consult qualification outcome (free text; null clears it).
export async function setConsultationOutcome(id: string, outcome: string | null): Promise<ActionResult> {
  const gate = await requireConsultEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const next = typeof outcome === "string" && outcome.trim() !== "" ? outcome.trim() : null
  const { data: updated, error } = await supabase
    .from("consultations")
    .update({ outcome: next, last_activity: new Date().toISOString() })
    .eq("id", id)
    .select("id, lead_id")
    .single()
  if (error || !updated) return { error: "Couldn't update the outcome." }

  await audit(supabase, gate.user.id, id, next ?? "", "outcome_set")
  await recordLeadEvent(
    updated.lead_id,
    next ? `Consultation outcome — ${next}` : "Consultation outcome cleared",
  )
  revalidate(updated.lead_id)
  return { ok: true }
}

// Permanently delete a consultation — a HARD delete (gated by the consultations_delete RLS policy,
// migration 0039), distinct from the soft cancel (status) or `archived`. Records a "deleted" event on
// the lead's timeline so its history keeps a trace.
export async function deleteConsultation(id: string): Promise<ActionResult> {
  const gate = await requireConsultEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  // .select().single() turns a 0-row delete (RLS / wrong id) into a real error, and returns the row so
  // we can audit + record the event after it's gone.
  const { data: deleted, error } = await supabase
    .from("consultations")
    .delete()
    .eq("id", id)
    .select("id, lead_id, type")
    .single()
  if (error || !deleted) return { error: "Couldn't delete the consultation." }

  await audit(supabase, gate.user.id, id, deleted.type, "deleted")
  await recordLeadEvent(deleted.lead_id, `Consultation deleted — ${deleted.type}`)
  revalidate(deleted.lead_id)
  return { ok: true }
}
