import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

// Public Storage bucket holding profile photos, RLS-locked per user (migration 0032).
export const AVATAR_BUCKET = "avatars"

// Build the public URL for a stored avatar object. The bucket is public, so getPublicUrl is a
// pure string builder (no network call). Returns null when no avatar is set, so the UI falls
// back to initials.
export function avatarPublicUrl(
  supabase: SupabaseClient<Database>,
  path: string | null | undefined,
): string | null {
  return path ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null
}
