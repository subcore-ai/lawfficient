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
  // TEMP: RBAC access-token hook validation.
  // permissions   = via getUser().app_metadata (reflects the DB)
  // jwtPermissions = decoded straight from the access token (what the hook stamped)
  permissions: AppPermission[] | null
  jwtPermissions: AppPermission[] | null
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
      jwtPermissions: null,
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

  // Authoritative read: decode the access token itself. getCurrentUser() above reads
  // getUser().app_metadata, which reflects the DB — the hook's claim lives only in the JWT.
  const { data: sessionData } = await supabase.auth.getSession()
  const payloadB64 = sessionData.session?.access_token?.split(".")[1]
  let jwtPermissions: AppPermission[] | null = null
  if (payloadB64) {
    try {
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
        app_metadata?: { permissions?: unknown }
      }
      const p = payload.app_metadata?.permissions
      jwtPermissions = Array.isArray(p) ? (p as AppPermission[]) : null
    } catch {
      jwtPermissions = null
    }
  }

  return {
    name: me.name,
    email: me.email,
    role: me.role,
    pod,
    editable: true,
    googleConnected,
    permissions: me.permissions,
    jwtPermissions,
  }
}

export default async function ProfilePage() {
  const view = await load()
  const { permissions, jwtPermissions, ...profile } = view
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
            via <code>getUser()</code> (what the app reads today):{" "}
            <strong>{permissions == null ? "null" : `${permissions.length} permission(s)`}</strong>
          </div>
          <div>
            via JWT claim (what the hook stamped):{" "}
            <strong>{jwtPermissions == null ? "null" : `${jwtPermissions.length} permission(s)`}</strong>
          </div>
          {jwtPermissions != null && (
            <ul className="mt-1 list-disc pl-5">
              {jwtPermissions.map((p) => (
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
