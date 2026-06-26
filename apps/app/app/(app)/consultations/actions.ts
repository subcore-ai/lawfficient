"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { zonedWallTimeToUtcISO } from "@/lib/consultations/time"
import { parseConsultationInput, type ConsultationStatus } from "@/lib/consultations/validation"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }

const PATH = "/consultations"

// The lifecycle moves this action represents (cancel / complete / mark no-show). Scheduling states
// (`scheduled`/`paid`/`rescheduled`) are reached via create + reschedule, not here.
const STATUS_TRANSITIONS: ConsultationStatus[] = ["completed", "no_show", "canceled"]

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

// Consultation counts feed the dashboard (/), so revalidate it alongside the list.
function revalidate() {
  revalidatePath(PATH)
  revalidatePath("/")
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

export async function createConsultation(formData: FormData): Promise<ActionResult> {
  const gate = await requireConsultEdit()
  if (!gate.ok) return { error: gate.error }

  const core = readInput(formData)
  if (!core.ok) return { error: core.error }

  // The form sends a naive wall time + the chosen zone; store the true UTC instant.
  const startAt = zonedWallTimeToUtcISO(core.value.startAt, core.value.timeZone)
  if (!startAt) return { error: "Couldn't read the date/time for that time zone." }

  const supabase = await createClient()
  // firm_id defaults to current_firm_id(); the composite FKs reject a lead/attorney from another firm.
  // A paid booking starts in the combined "scheduled & paid" state; otherwise plain "scheduled".
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
      status: core.value.paid ? "paid" : "scheduled",
      booked_by_id: gate.user.id,
    })
    .select("id")
    .single()
  if (error?.code === "23503") return { error: "That lead or attorney isn't in your firm." }
  if (error || !inserted) return { error: "Couldn't book the consultation." }

  await audit(supabase, gate.user.id, inserted.id, core.value.type, "created")
  revalidate()
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
  // Edit the fields — only for a NON-terminal consult (a finalized one can't be edited, consistent
  // with reschedule / setStatus). The `.in()` is the atomic guard; status is owned by those actions.
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
    .select("id")
    .maybeSingle()
  if (error?.code === "23503") return { error: "That attorney isn't in your firm." }
  if (error) return { error: "Couldn't update the consultation." }
  if (!updated) return { error: "This consultation is finalized and can't be edited." }

  // Keep status in sync with `paid` for a scheduled/paid consult (leaves a rescheduled one alone). The
  // `.in()` filter is atomic; a sync failure is SURFACED — never report success with paid/status diverged.
  const { error: syncErr } = await supabase
    .from("consultations")
    .update({ status: core.value.paid ? "paid" : "scheduled" })
    .eq("id", id)
    .in("status", ["scheduled", "paid"])
  if (syncErr) return { error: "Couldn't fully update the consultation. Please try again." }

  await audit(supabase, gate.user.id, id, core.value.type, "updated")
  revalidate()
  return { ok: true }
}

// Move the start time + flag the consult as rescheduled. `startAtWall` is a naive wall time; it's
// interpreted in the consult's stored time zone.
export async function rescheduleConsultation(id: string, startAtWall: string): Promise<ActionResult> {
  const gate = await requireConsultEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: current, error: readErr } = await supabase
    .from("consultations")
    .select("time_zone, status")
    .eq("id", id)
    .single()
  if (readErr || !current) return { error: "Couldn't reschedule the consultation." }
  if (current.status === "completed" || current.status === "canceled" || current.status === "no_show") {
    return { error: "This consultation is finalized and can't be rescheduled." }
  }

  const startAt = zonedWallTimeToUtcISO(startAtWall, current.time_zone)
  if (!startAt) return { error: "Choose a valid date and time." }

  // The `.in()` filter makes the move atomic — a consult that became terminal between the read and the
  // write is excluded (0 rows), so we never reschedule a finalized one.
  const { data: updated, error } = await supabase
    .from("consultations")
    .update({ start_at: startAt, status: "rescheduled", last_activity: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "paid", "rescheduled"])
    .select("id")
    .maybeSingle()
  if (error) return { error: "Couldn't reschedule the consultation." }
  if (!updated) return { error: "This consultation is finalized and can't be rescheduled." }

  await audit(supabase, gate.user.id, id, "", "rescheduled")
  revalidate()
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
    .select("id")
    .maybeSingle()
  if (error) return { error: "Couldn't update the consultation." }
  if (!updated) return { error: "This consultation is already finalized." }

  await audit(supabase, gate.user.id, id, status, "status_changed")
  revalidate()
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
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't update the outcome." }

  await audit(supabase, gate.user.id, id, next ?? "", "outcome_set")
  revalidate()
  return { ok: true }
}
