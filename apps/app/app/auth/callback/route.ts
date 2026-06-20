import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// OAuth (Google) callback. Unlike /auth/confirm (email token_hash), OAuth uses the
// PKCE code flow — exchange the code for a session, then resolve the user to a
// firm-bound profile. There is NO open signup: a Google identity only gets in if an
// admin already provisioned it (invited or active). See specs/24-user-management.md.
//
// Relies on Supabase linking the Google identity to the existing invite/password
// user by verified email, so the auth user id matches the provisioned profile.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"
  // Same-origin relative redirects only — reject protocol-relative ("//evil.com") and
  // backslash ("/\\evil") targets that would resolve to an external origin.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/"

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin))
  }

  const supabase = await createClient()
  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !exchanged.user) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin))
  }
  const user = exchanged.user

  // Look up the profile with the admin client: an invited user can't read their own
  // row via RLS (current_firm_id() only resolves for active staff).
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    // No invite for this Google account — don't leave a stray auth user behind.
    await admin.auth.admin.deleteUser(user.id)
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL("/login?error=no_account", origin))
  }

  if (profile.status === "disabled") {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL("/login?error=account_inactive", origin))
  }

  if (profile.status === "invited") {
    // First Google sign-in doubles as invite acceptance — activate the profile
    // (app_metadata.status='active' re-fires the 0005 trigger).
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), status: "active" },
    })
  }

  return NextResponse.redirect(new URL(safeNext, origin))
}
