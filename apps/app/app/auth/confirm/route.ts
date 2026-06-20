import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

// Consumes a Supabase email link (invite / recovery / email-change). The link
// carries token_hash + type; verifyOtp exchanges it for a cookie session, then we
// redirect to `next` (the set-password page for invites). Invite links are
// non-PKCE, so this token_hash flow — not the code/exchangeCodeForSession flow — is
// the correct one. See specs/24-user-management.md.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/"
  // Same-origin relative redirects only. Reject protocol-relative ("//evil.com") and
  // backslash ("/\\evil") targets that new URL() would resolve to an external origin.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/"

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin))
    }
  }

  return NextResponse.redirect(new URL("/login?error=link_invalid", origin))
}
