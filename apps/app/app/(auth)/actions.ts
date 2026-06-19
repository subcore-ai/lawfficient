"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export type SignInState = { error: string } | null

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  // Until Supabase is wired, fall back to the Phase 0 mock behavior so the
  // app stays demoable without credentials.
  if (!isSupabaseConfigured()) {
    redirect("/")
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }

  // Credentials are valid; the app shell only admits active staff. Distinguish a
  // genuinely missing/inactive profile (sign out + explain) from a transient
  // query failure (keep the session, ask to retry) so a blip doesn't lock people out.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user?.id ?? "")
    .maybeSingle()

  if (profileError) {
    return { error: "We couldn't verify your account just now. Please try again." }
  }
  if ((profile as { status?: string } | null)?.status !== "active") {
    await supabase.auth.signOut()
    return { error: "Your account isn't active. Contact your firm administrator." }
  }

  redirect("/")
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect("/login")
}
