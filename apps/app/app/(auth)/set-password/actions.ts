"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type ActivateState = { error: string } | null

// Completes invite acceptance: the user already has a session (from /auth/confirm
// verifying the invite link) but no password and a profile still `invited`. Setting
// the password + flipping status to active is one privileged call — the user can't
// change their own status (guard_profile_privileges), and app_metadata.status='active'
// re-fires the 0005 trigger to update profiles.status.
export async function activateAccount(
  _prev: ActivateState,
  formData: FormData,
): Promise<ActivateState> {
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  if (password.length < 8) return { error: "Password must be at least 8 characters." }
  if (password !== confirm) return { error: "Those passwords don't match." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { error: "Your activation link has expired. Ask an admin to resend the invite." }
  }

  // Only an *invited* account activates here — otherwise an already-active (or
  // disabled) user with a live session could reset their password without the current
  // one. Read via the admin client: an invited user can't see their own row under RLS.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle()
  if (!profile || profile.status !== "invited") {
    return { error: "This account is already active or can't be activated." }
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, {
    password,
    app_metadata: { ...(data.user.app_metadata ?? {}), status: "active" },
  })
  if (updateError) {
    return { error: "We couldn't activate your account just now. Please try again." }
  }

  redirect("/")
}
