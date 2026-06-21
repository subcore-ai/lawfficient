import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import {
  InviteUserDialog,
  type ManagedUser,
  type RoleOption,
} from "@/components/settings/settings-dialogs"
import { UsersTable } from "@/components/settings/users-table"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { CURRENT_USER, STAFF } from "@/data"
import type { StaffUser } from "@/data/types"

export const metadata = { title: "Settings · Team" }

type Loaded = {
  users: ManagedUser[]
  roles: RoleOption[]
  currentUserId: string
  canManage: boolean
  canManageRoles: boolean
}

async function load(): Promise<Loaded> {
  // Phase 0 fallback: with no Supabase wired, render the mock team so the app
  // stays demoable (same contract as the auth flow + app shell).
  if (!isSupabaseConfigured()) {
    // Read-only mock: the management actions are server-backed, so without
    // Supabase they can't complete — don't render controls that would fail.
    return {
      users: STAFF.map((u) => ({ ...u, roleIds: [] })),
      roles: [],
      currentUserId: CURRENT_USER.id,
      canManage: false,
      canManageRoles: false,
    }
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  // RLS scopes all three to the caller's firm. Load the roster, the firm's roles
  // (multi-select options), and every assignment so each row knows its role set.
  const [profilesRes, rolesRes, userRolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email, initials, role, status, pod_id")
      .order("name"),
    supabase
      .from("roles")
      .select("id, key, name, is_system")
      .order("is_system", { ascending: false })
      .order("name"),
    supabase.from("user_roles").select("user_id, role_id"),
  ])
  // Surface RLS/network failures via the error boundary instead of rendering an
  // empty team (which would read as "no members").
  if (profilesRes.error) throw profilesRes.error
  if (rolesRes.error) throw rolesRes.error
  if (userRolesRes.error) throw userRolesRes.error

  const roleIdsByUser = new Map<string, string[]>()
  for (const ur of userRolesRes.data ?? []) {
    const list = roleIdsByUser.get(ur.user_id)
    if (list) list.push(ur.role_id)
    else roleIdsByUser.set(ur.user_id, [ur.role_id])
  }

  const users: ManagedUser[] = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    initials: p.initials,
    role: p.role as StaffUser["role"],
    status: p.status as StaffUser["status"],
    podId: p.pod_id ?? undefined,
    roleIds: roleIdsByUser.get(p.id) ?? [],
  }))
  const roles: RoleOption[] = (rolesRes.data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    isSystem: r.is_system,
  }))

  return {
    users,
    roles,
    currentUserId: me?.id ?? "",
    canManage: me?.permissions?.includes("users.manage") ?? false,
    canManageRoles: me?.permissions?.includes("settings.manage") ?? false,
  }
}

export default async function SettingsUsersPage() {
  const { users, roles, currentUserId, canManage, canManageRoles } = await load()

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
        <UsersTable
          users={users}
          currentUserId={currentUserId}
          canManage={canManage}
          canManageRoles={canManageRoles}
          roles={roles}
        />
      </CardContent>
    </Card>
  )
}
