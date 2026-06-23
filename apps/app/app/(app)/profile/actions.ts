"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath, revalidateTag } from "next/cache"

import { getCurrentUser } from "@/lib/auth/session"
import { staffTag } from "@/lib/reference"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }
type NameResult = { ok: true; changed: boolean } | { error: string }

const PROFILE_PATH = "/profile"
const NAME_MAX = 100

const AVATAR_BUCKET = "avatars"
const AVATAR_MAX_BYTES = 4 * 1024 * 1024
// Allowed upload types → file extension. Mirrors the bucket's allowed_mime_types (migration 0032).
const AVATAR_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

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

  revalidateTag(staffTag(user.firmId), { expire: 0 }) // purge the per-firm staff cache (assignee names)
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

// Upload (or replace) the signed-in user's avatar. The file goes to the public
// `avatars` bucket under the user's own {uid}/ folder (RLS-locked, migration 0032);
// only the object path is stored on profiles. A fresh filename per upload means the
// public URL changes, so caches never serve a stale image.
export async function updateMyAvatar(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { error: "You're not signed in." }

  const file = formData.get("avatar")
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." }
  const ext = AVATAR_EXT[file.type]
  if (!ext) return { error: "Use a PNG, JPG, or WEBP image." }
  if (file.size > AVATAR_MAX_BYTES) return { error: "That image is larger than 4 MB." }

  const supabase = await createClient()
  const path = `${user.id}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) return { error: "Couldn't upload your photo. Please try again." }

  // Capture the previous object so it can be cleaned up once the pointer moves.
  const { data: prev } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single()
  const oldPath = (prev as { avatar_path: string | null } | null)?.avatar_path ?? null

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id)
  if (error) {
    // Pointer didn't move — remove the just-uploaded object so we don't orphan it.
    await supabase.storage.from(AVATAR_BUCKET).remove([path])
    return { error: "Couldn't save your photo. Please try again." }
  }

  if (oldPath && oldPath !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]) // best-effort
  }

  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: user.id,
    label: user.name,
    action: "profile_updated",
    by_user_id: user.id,
  })

  revalidatePath(PROFILE_PATH)
  revalidatePath("/", "layout") // the topbar avatar resolves via getCurrentUser()
  return { ok: true }
}

// Clear the avatar (revert to initials) and delete the stored object.
export async function removeMyAvatar(): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { error: "You're not signed in." }

  const supabase = await createClient()
  const { data: prev } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single()
  const oldPath = (prev as { avatar_path: string | null } | null)?.avatar_path ?? null
  if (!oldPath) return { ok: true }

  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", user.id)
  if (error) return { error: "Couldn't remove your photo. Please try again." }

  await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]) // best-effort

  await supabase.from("audit_log").insert({
    entity: "user",
    entity_id: user.id,
    label: user.name,
    action: "profile_updated",
    by_user_id: user.id,
  })

  revalidatePath(PROFILE_PATH)
  revalidatePath("/", "layout")
  return { ok: true }
}
