"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { validateWindows, type WindowInput } from "@/lib/availability/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }

const PATH = "/settings/scheduling"

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }

// RLS (authorize('settings.manage'), firm-scoped) is the real gate; this returns a clean error first.
async function requireAdmin(): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!(user.permissions?.includes("settings.manage") ?? false))
    return { ok: false, error: "You don't have permission to manage scheduling." }
  return { ok: true, user }
}

// Replace an attorney's full weekly office hours (delete-all + insert). Admin-only + low-frequency, so
// the two-step replace (non-atomic) is acceptable; we validate first so the insert can't fail on shape.
export async function setAttorneyAvailability(
  attorneyId: string,
  windows: WindowInput[]
): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  if (typeof attorneyId !== "string" || !attorneyId) return { error: "Pick a team member." }

  const valid = validateWindows(windows)
  if (!valid.ok) return { error: valid.error }

  // The target must be schedulable + in this firm. Read the profile via the service-role client,
  // explicitly firm-scoped: profiles are users.manage-gated under RLS, but this feature is
  // settings.manage, so we don't route profile access through the RLS client. (The composite FK on
  // insert is the hard firm-membership guarantee; this is the friendly pre-check + schedulable gate.)
  const admin = createAdminClient()
  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("id, schedulable")
    .eq("id", attorneyId)
    .eq("firm_id", gate.user.firmId)
    .maybeSingle()
  if (profErr) return { error: "Couldn't save office hours." }
  if (!prof) return { error: "That team member isn't in your firm." }
  if (!prof.schedulable) return { error: "Mark this person schedulable before setting office hours." }

  // attorney_availability writes go through RLS (settings.manage); firm_id defaults to current_firm_id().
  const supabase = await createClient()
  const del = await supabase.from("attorney_availability").delete().eq("attorney_id", attorneyId)
  if (del.error) return { error: "Couldn't save office hours." }

  if (valid.value.length > 0) {
    const rows = valid.value.map((w) => ({
      attorney_id: attorneyId,
      weekday: w.weekday,
      start_time: w.startTime,
      end_time: w.endTime,
    }))
    const ins = await supabase.from("attorney_availability").insert(rows)
    if (ins.error) return { error: "Couldn't save office hours." }
  }

  revalidatePath(PATH)
  return { ok: true }
}

// Toggle who takes consultations. Turning it off clears the attorney's office hours (meaningless then).
export async function setSchedulable(attorneyId: string, schedulable: boolean): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  if (typeof attorneyId !== "string" || !attorneyId) return { error: "Pick a team member." }

  // Toggling 'schedulable' is a profiles write (users.manage-gated under RLS), but this feature is
  // settings.manage — so update via the service-role client, firm-scoped, touching only schedulable.
  // The last-admin guard (0006) still fires; schedulable isn't a privileged field, so it won't block.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("profiles")
    .update({ schedulable })
    .eq("id", attorneyId)
    .eq("firm_id", gate.user.firmId)
    .select("id")
  if (error || !data || data.length === 0) return { error: "Couldn't update." }

  if (!schedulable) {
    // Office hours are meaningless once someone isn't bookable — clear them (RLS, settings.manage).
    const supabase = await createClient()
    await supabase.from("attorney_availability").delete().eq("attorney_id", attorneyId)
  }
  revalidatePath(PATH)
  return { ok: true }
}
