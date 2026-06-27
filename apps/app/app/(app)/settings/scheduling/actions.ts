"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { validateWindows, type WindowInput } from "@/lib/availability/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }

const PATH = "/settings/scheduling"
const MY_PATH = "/profile/office-hours"

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }

// RLS (authorize('settings.manage'), firm-scoped) is the real gate; this returns a clean error first.
async function requireAdmin(): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  // Never run a firm-scoped query with an empty firm id: PostgREST drops an `.eq(col, undefined)`
  // predicate, which on the service-role client (no RLS) would be cross-tenant. Fail closed.
  if (!user.firmId) return { ok: false, error: "Your session is missing firm context." }
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

  // Replace the whole week atomically: the RPC does delete-all + insert in ONE transaction (under the
  // caller's RLS — settings.manage), so a mid-save failure can't leave the attorney with no hours.
  const supabase = await createClient()
  const { error: rpcErr } = await supabase.rpc("set_attorney_availability", {
    p_attorney_id: attorneyId,
    p_windows: valid.value,
  })
  if (rpcErr) return { error: "Couldn't save office hours." }

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
  // We deliberately KEEP any existing office hours when turning this off: the rows are inert while a
  // person isn't schedulable (the editor + booking only consider schedulable staff), and re-enabling
  // restores their schedule instead of silently dropping it.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("profiles")
    .update({ schedulable })
    .eq("id", attorneyId)
    .eq("firm_id", gate.user.firmId)
    .select("id")
  if (error || !data || data.length === 0) return { error: "Couldn't update." }

  revalidatePath(PATH)
  return { ok: true }
}

// Self-service: the signed-in user replaces their OWN office hours (from their profile). RLS (0041)
// allows the owner (attorney_id = auth.uid()), and this goes through the same atomic, advisory-locked
// RPC the admin path uses — just pinned to the caller's own id, so it can't touch anyone else's.
export async function setMyAvailability(windows: WindowInput[]): Promise<ActionResult> {
  const me = await getCurrentUser()
  if (!me) return { error: "You're not signed in." }
  if (!me.id) return { error: "Your session is missing user context." }

  const valid = validateWindows(windows)
  if (!valid.ok) return { error: valid.error }

  const supabase = await createClient()
  // Only schedulable users have office hours — an admin decides who takes consultations.
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("schedulable")
    .eq("id", me.id)
    .maybeSingle()
  if (profErr) return { error: "Couldn't save office hours." }
  if (!prof?.schedulable) {
    return { error: "You're not set up to take consultations yet — ask an admin to enable it." }
  }

  const { error } = await supabase.rpc("set_attorney_availability", {
    p_attorney_id: me.id,
    p_windows: valid.value,
  })
  if (error) return { error: "Couldn't save office hours." }

  revalidatePath(MY_PATH)
  revalidatePath(PATH) // the admin Settings → Office hours editor shows the same hours
  return { ok: true }
}
