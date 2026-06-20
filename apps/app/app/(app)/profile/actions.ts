"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }
type NameResult = { ok: true; changed: boolean } | { error: string }

const PROFILE_PATH = "/profile"
const NAME_MAX = 100

// Self-service display-name change. A user may update their own profiles row
// (RLS profiles_update_self); the guard_profile_privileges trigger blocks any
// change to role/status/firm on one's own row, and we only ever set `name` —
// so no admin/service-role client is needed.
export async function updateMyName(formData: FormData): Promise<NameResult> {
  const user = await getCurrentUser()
  if (!user) return { error: "You're not signed in." }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Name is required." }
  if (name.length > NAME_MAX) return { error: `Name must be ${NAME_MAX} characters or fewer.` }
  if (name === user.name) return { ok: true, changed: false }

  const supabase = await createClient()
  const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id)
  if (error) return { error: "Couldn't save your name. Please try again." }

  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: user.id,
    label: name,
    action: "profile_updated",
    by_user_id: user.id,
  })

  revalidatePath(PROFILE_PATH)
  // The app-shell topbar resolves the display name via getCurrentUser().
  revalidatePath("/", "layout")
  return { ok: true, changed: true }
}

// Self-service password change for an already-authenticated user. Supabase
// updates the current user's credential and keeps the session valid afterwards.
export async function changeMyPassword(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { error: "You're not signed in." }

  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  if (password.length < 8) return { error: "Password must be at least 8 characters." }
  if (password !== confirm) return { error: "Those passwords don't match." }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: user.id,
    label: user.name,
    action: "password_changed",
    by_user_id: user.id,
  })

  return { ok: true }
}
