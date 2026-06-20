import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { InviteUserDialog } from "@/components/settings/settings-dialogs"
import { UsersTable } from "@/components/settings/users-table"
import { can } from "@/lib/auth/permissions"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { CURRENT_USER, STAFF } from "@/data"
import type { StaffUser } from "@/data/types"

export const metadata = { title: "Settings · Team" }

type Loaded = { users: StaffUser[]; currentUserId: string; canManage: boolean }

async function load(): Promise<Loaded> {
  // Phase 0 fallback: with no Supabase wired, render the mock team so the app
  // stays demoable (same contract as the auth flow + app shell).
  if (!isSupabaseConfigured()) {
    // Read-only mock: the management actions are server-backed, so without
    // Supabase they can't complete — don't render controls that would fail.
    return { users: STAFF, currentUserId: CURRENT_USER.id, canManage: false }
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  // RLS scopes this to the caller's firm — no explicit firm filter needed.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, initials, role, status, pod_id")
    .order("name")
  // Surface RLS/network failures via the error boundary instead of rendering an
  // empty team (which would read as "no members").
  if (error) throw error

  const users: StaffUser[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    initials: p.initials,
    role: p.role as StaffUser["role"],
    status: p.status as StaffUser["status"],
    podId: p.pod_id ?? undefined,
  }))

  return {
    users,
    currentUserId: me?.id ?? "",
    canManage: me ? can(me.role, "manageUsers") : false,
  }
}

export default async function SettingsUsersPage() {
  const { users, currentUserId, canManage } = await load()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team members</CardTitle>
        <CardDescription>Manage team access and roles</CardDescription>
        {canManage ? (
          <CardAction>
            <InviteUserDialog />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        <UsersTable users={users} currentUserId={currentUserId} canManage={canManage} />
      </CardContent>
    </Card>
  )
}
