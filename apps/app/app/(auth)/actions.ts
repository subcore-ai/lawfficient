"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { getCurrentUser } from "@/lib/auth/session"

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
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }

  // Credentials are valid, but the app shell only admits active staff. If there's
  // no active profile, sign back out and explain rather than bouncing to /login.
  const user = await getCurrentUser()
  if (!user) {
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
