import { redirect } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { ProfileSettings } from "@/components/profile-form"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { CURRENT_USER } from "@/data"
import type { Role } from "@/data/types"

export const metadata = { title: "My profile" }

type ProfileView = {
  name: string
  email: string
  role: Role
  pod: string | null
  editable: boolean
  googleConnected: boolean
}

async function load(): Promise<ProfileView> {
  // Phase 0 fallback: with no Supabase wired, show the mock identity read-only
  // (the save actions are server-backed, so they can't complete without it).
  if (!isSupabaseConfigured()) {
    return {
      name: CURRENT_USER.name,
      email: CURRENT_USER.email,
      role: CURRENT_USER.role,
      pod: null,
      editable: false,
      googleConnected: false,
    }
  }

  const me = await getCurrentUser()
  if (!me) redirect("/login")

  const supabase = await createClient()

  // A linked Google identity only exists if Google sign-in was enabled and used,
  // so its presence is the signal — no separate "is Google on" flag is needed.
  const { data } = await supabase.auth.getUser()
  const googleConnected = (data?.user?.identities ?? []).some((i) => i.provider === "google")

  let pod: string | null = null
  if (me.podId) {
    const { data } = await supabase.from("pods").select("name").eq("id", me.podId).maybeSingle()
    pod = data?.name ?? null
  }

  return { name: me.name, email: me.email, role: me.role, pod, editable: true, googleConnected }
}

export default async function ProfilePage() {
  const view = await load()
  return (
    <>
      <PageHeader title="My profile" description="Manage your display name and password." />
      <div className="flex max-w-2xl flex-col gap-6">
        <ProfileSettings {...view} />
      </div>
    </>
  )
}
