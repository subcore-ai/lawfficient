import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { CreateRoleDialog, RoleRowActions, type RoleRow } from "@/components/settings/roles-editor"
import { getCurrentUser } from "@/lib/auth/session"
import { ALL_PERMISSIONS, type AppPermission } from "@/lib/rbac/permissions"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { ROLE_LABELS } from "@/data"
import type { Role } from "@/data/types"

export const metadata = { title: "Settings · Roles" }

type Loaded = { roles: RoleRow[]; canManage: boolean }

async function load(): Promise<Loaded> {
  // Phase 0 fallback: with no Supabase wired, list the seeded system roles read-only
  // so the page stays demoable (same contract as the rest of the app shell).
  if (!isSupabaseConfigured()) {
    const roles: RoleRow[] = (Object.keys(ROLE_LABELS) as Role[]).map((key) => ({
      id: key,
      key,
      name: ROLE_LABELS[key],
      isSystem: true,
      permissions: [],
    }))
    return { roles, canManage: false }
  }

  const me = await getCurrentUser()
  const supabase = await createClient()
  // RLS scopes to the caller's firm. Embed each role's granted permissions so the
  // matrix loads in one round-trip. System roles first, then alphabetical.
  const { data, error } = await supabase
    .from("roles")
    .select("id, key, name, is_system, role_permissions(permission)")
    .order("is_system", { ascending: false })
    .order("name")
  if (error) throw error

  const roles: RoleRow[] = (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    isSystem: r.is_system,
    permissions: (r.role_permissions ?? []).map((rp) => rp.permission as AppPermission),
  }))

  // Phase 1: role management is admin-only — mirrors requireAdmin in the actions and
  // the roles_admin_write RLS. Phase 2b flips this to authorize('settings.manage').
  return { roles, canManage: me?.role === "admin" }
}

function summarize(role: RoleRow): string {
  const n = role.permissions.length
  if (n === 0) return "No permissions yet"
  if (n >= ALL_PERMISSIONS.length) return "Full access"
  return `${n} permission${n === 1 ? "" : "s"}`
}

export default async function SettingsRolesPage() {
  const { roles, canManage } = await load()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles &amp; permissions</CardTitle>
        <CardDescription>Define roles and the modules each one can access</CardDescription>
        {canManage ? (
          <CardAction>
            <CreateRoleDialog />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col">
        {roles.map((role) => (
          <div
            key={role.id}
            className="border-border flex items-center justify-between gap-3 border-b py-3 first:pt-0 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{role.name}</p>
                <Badge variant={role.isSystem ? "secondary" : "outline"}>
                  {role.isSystem ? "System" : "Custom"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">{summarize(role)}</p>
            </div>
            {canManage ? <RoleRowActions role={role} /> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
