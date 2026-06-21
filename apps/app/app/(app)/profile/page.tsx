import { redirect } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { ProfileSettings } from "@/components/profile-form"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { CURRENT_USER } from "@/data"
import type { Role } from "@/data/types"
import type { AppPermission } from "@/lib/rbac/permissions"

export const metadata = { title: "My profile" }

type ProfileView = {
  name: string
  email: string
  role: Role
  pod: string | null
  editable: boolean
  googleConnected: boolean
  // TEMP: RBAC access-token hook validation — null means the hook didn't stamp.
  permissions: AppPermission[] | null
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
      permissions: null,
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

  return { name: me.name, email: me.email, role: me.role, pod, editable: true, googleConnected, permissions: me.permissions }
}

export default async function ProfilePage() {
  const view = await load()
  const { permissions, ...profile } = view
  return (
    <>
      <PageHeader title="My profile" description="Manage your display name and password." />
      <div className="flex max-w-2xl flex-col gap-6">
        {/* TEMP — RBAC access-token hook validation. Remove this whole block after checking. */}
        <div className="rounded-md border border-dashed p-4 text-sm">
          <div className="font-semibold">RBAC hook check (temporary)</div>
          <div className="mt-1">
            role: <code>{profile.role}</code>
          </div>
          <div>
            permissions stamped:{" "}
            {permissions == null
              ? "NO — falling back (hook off, or token not refreshed since you enabled it)"
              : `YES — ${permissions.length} permission(s)`}
          </div>
          {permissions != null && (
            <ul className="mt-1 list-disc pl-5">
              {permissions.map((p) => (
                <li key={p}>
                  <code>{p}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ProfileSettings {...profile} />
      </div>
    </>
  )
}
