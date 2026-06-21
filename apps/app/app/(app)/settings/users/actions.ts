"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/permissions"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseInviteInput, parseRole } from "@/lib/users/validation"

export type ActionResult = { ok: true } | { error: string }

const USERS_PATH = "/settings/users"

type AdminGate = { ok: true; user: CurrentUser } | { ok: false; error: string }

// Every action funnels through this — signed-out callers and non-admins can't
// manage users. RLS is the real enforcement; this gives a clean error first.
async function requireAdmin(): Promise<AdminGate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!hasPermission(user.permissions, user.role, "users.manage", "manageUsers"))
    return { ok: false, error: "You don't have permission to manage users." }
  return { ok: true, user }
}

// A firm's *other* active admins, or null if the query fails. Callers only
// hard-block on a definitive 0, so a transient query error can't produce a
// misleading "last admin" message — the 0006 DB trigger is the real backstop.
async function otherActiveAdmins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  firmId: string,
  exceptUserId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firmId)
    .eq("role", "admin")
    .eq("status", "active")
    .neq("id", exceptUserId)
  if (error) return null
  return count ?? 0
}

async function confirmUrl(): Promise<string | undefined> {
  const base = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""
  const origin = base.replace(/\/$/, "")
  return origin ? `${origin}/auth/confirm` : undefined
}

export async function inviteUser(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const admin = gate.user

  const parsed = parseInviteInput({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  })
  if (!parsed.ok) return { error: parsed.error }
  const { name, email, role } = parsed.value

  const adminClient = createAdminClient()

  // Create the auth user + send the invite email (Supabase SMTP; Mailpit locally).
  const invited = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: await confirmUrl(),
  })
  if (invited.error || !invited.data.user) {
    return { error: invited.error?.message ?? "Could not send the invite." }
  }

  // Bind to this firm + role + invited status via app_metadata (service-role only,
  // never user_metadata). The 0005 trigger provisions the profile on this update.
  const bound = await adminClient.auth.admin.updateUserById(invited.data.user.id, {
    app_metadata: { firm_id: admin.firmId, role, status: "invited", name },
  })
  if (bound.error) {
    // Undo the half-made invite so the address can be retried cleanly.
    await adminClient.auth.admin.deleteUser(invited.data.user.id)
    return { error: "Could not finish creating the invite. Please try again." }
  }

  const supabase = await createClient()
  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: invited.data.user.id,
    label: name,
    action: "invited",
    by_user_id: admin.id,
  })

  revalidatePath(USERS_PATH)
  return { ok: true }
}

export async function resendInvite(userId: string): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const admin = gate.user

  const supabase = await createClient()
  const { data: target } = await supabase
    .from("profiles")
    .select("id, email, name, role, status, pod_id")
    .eq("id", userId)
    .maybeSingle()
  if (!target) return { error: "User not found." }
  if (target.status !== "invited") return { error: "Only pending invites can be resent." }

  // Supabase has no admin "resend invite", and inviteUserByEmail rejects an
  // existing address — so re-issue by replacing the un-accepted placeholder.
  // Necessarily non-atomic (no transactional admin API): check every step and
  // clean up partial state. Safe to replace — an invited user has no data yet.
  const adminClient = createAdminClient()
  const removed = await adminClient.auth.admin.deleteUser(userId)
  if (removed.error) return { error: "Could not resend the invite. Please try again." }

  const invited = await adminClient.auth.admin.inviteUserByEmail(target.email, {
    data: { name: target.name },
    redirectTo: await confirmUrl(),
  })
  if (invited.error || !invited.data.user) {
    return { error: "Could not resend the invite — the old one was removed. Please send a new invite." }
  }

  const bound = await adminClient.auth.admin.updateUserById(invited.data.user.id, {
    app_metadata: { firm_id: admin.firmId, role: target.role, status: "invited", name: target.name },
  })
  if (bound.error) {
    await adminClient.auth.admin.deleteUser(invited.data.user.id)
    return { error: "Could not finish resending the invite. Please send a new invite." }
  }

  if (target.pod_id) {
    await supabase.from("profiles").update({ pod_id: target.pod_id }).eq("id", invited.data.user.id)
  }

  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: invited.data.user.id,
    label: target.name,
    action: "invite_resent",
    by_user_id: admin.id,
  })

  revalidatePath(USERS_PATH)
  return { ok: true }
}

export async function revokeInvite(userId: string): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const admin = gate.user

  const supabase = await createClient()
  const { data: target } = await supabase
    .from("profiles")
    .select("id, email, name, status")
    .eq("id", userId)
    .maybeSingle()
  if (!target) return { error: "User not found." }
  if (target.status !== "invited") return { error: "Only pending invites can be revoked." }

  // Audit before the profile row cascades away with the auth user.
  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: userId,
    label: target.email || target.name,
    action: "invite_revoked",
    by_user_id: admin.id,
  })

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { error: "Could not revoke the invite. Please try again." }

  revalidatePath(USERS_PATH)
  return { ok: true }
}

export async function setUserStatus(
  userId: string,
  status: "active" | "disabled",
): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const admin = gate.user
  if (userId === admin.id) return { error: "You can't change your own status." }

  const supabase = await createClient()
  const { data: target } = await supabase
    .from("profiles")
    .select("id, name, role, status, firm_id")
    .eq("id", userId)
    .maybeSingle()
  if (!target) return { error: "User not found." }

  // Only active⇄disabled toggles here. invited→active must go through the
  // activation flow, not an admin status flip.
  const validTransition =
    status === "disabled" ? target.status === "active" : target.status === "disabled"
  if (!validTransition) {
    return { error: "That status change isn't allowed from the user's current state." }
  }

  if (status === "disabled" && target.role === "admin" && target.status === "active") {
    if ((await otherActiveAdmins(supabase, target.firm_id, userId)) === 0) {
      return { error: "You can't disable the last active admin." }
    }
  }

  // Block (or restore) auth-level access. App access stops immediately via the
  // status='active' gate; the ban also blocks sign-in and token refresh.
  const adminClient = createAdminClient()
  const ban = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: status === "disabled" ? "876000h" : "none",
  })
  if (ban.error) return { error: "Could not update the account. Please try again." }

  const { error } = await supabase.from("profiles").update({ status }).eq("id", userId)
  if (error) {
    // Roll back the ban so Supabase Auth and the profile don't diverge.
    await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: status === "disabled" ? "none" : "876000h",
    })
    return { error: error.message }
  }

  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: userId,
    label: target.name,
    action: status === "disabled" ? "disabled" : "enabled",
    by_user_id: admin.id,
  })

  revalidatePath(USERS_PATH)
  return { ok: true }
}

export async function updateUserProfile(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const admin = gate.user

  const name = String(formData.get("name") ?? "").trim()
  const role = parseRole(formData.get("role"))
  if (!name) return { error: "Name is required." }
  if (!role) return { error: "Choose a valid role." }

  const supabase = await createClient()
  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, status, firm_id")
    .eq("id", userId)
    .maybeSingle()
  if (!target) return { error: "User not found." }

  // Demoting the firm's last active admin would lock everyone out of Settings.
  if (target.role === "admin" && role !== "admin" && target.status === "active") {
    if ((await otherActiveAdmins(supabase, target.firm_id, userId)) === 0) {
      return { error: "You can't change the role of the last active admin." }
    }
  }

  const { error } = await supabase.from("profiles").update({ name, role }).eq("id", userId)
  if (error) return { error: error.message }

  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: userId,
    label: name,
    action: "updated",
    by_user_id: admin.id,
  })

  revalidatePath(USERS_PATH)
  return { ok: true }
}

// Assign the full set of roles a user holds (multi-role). The user's *primary*
// role (profiles.role) is always kept — set_user_roles re-adds it server-side so a
// user can't lose their base role's access. The RPC replaces atomically; the
// user_roles RLS (firm-scoped, settings.manage / admin) is the real gate.
export async function setUserRoles(userId: string, roleIds: string[]): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const admin = gate.user

  const supabase = await createClient()
  const { data: target } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("id", userId)
    .maybeSingle()
  if (!target) return { error: "User not found." }

  const { error } = await supabase.rpc("set_user_roles", {
    p_user_id: userId,
    p_role_ids: roleIds,
  })
  if (error) return { error: "Couldn't update the user's roles." }

  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: userId,
    label: target.name,
    action: "roles_updated",
    by_user_id: admin.id,
  })

  revalidatePath(USERS_PATH)
  return { ok: true }
}

// Read a pending invite's activation link so an admin can share it directly
// (without waiting on email). invite_token_for (0007) returns the *existing*
// token, so the emailed link stays valid — generateLink would regenerate it.
export async function getInviteLink(
  userId: string,
): Promise<{ url: string } | { error: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: token, error } = await supabase.rpc("invite_token_for", { p_user_id: userId })
  if (error) return { error: "Couldn't generate the invite link." }
  if (!token) return { error: "No pending invite for this user." }

  const base = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""
  const origin = base.replace(/\/$/, "")
  if (!origin) return { error: "Couldn't resolve the app URL for the link." }
  // encodeURIComponent is defensive — GoTrue's token_hash is hex today, but a
  // future format with +/= would otherwise break the query string.
  const tokenHash = encodeURIComponent(token)
  return { url: `${origin}/auth/confirm?token_hash=${tokenHash}&type=invite&next=/set-password` }
}
