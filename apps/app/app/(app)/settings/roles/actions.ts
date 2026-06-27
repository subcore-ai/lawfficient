"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/gate"
import { ALL_PERMISSIONS, type AppPermission } from "@/lib/rbac/permissions"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }

const ROLES_PATH = "/settings/roles"

// Every action funnels through this — signed-out callers and users without
// settings.manage can't manage roles. RLS (authorize('settings.manage'), firm-scoped)
// is the real enforcement; this gives a clean error first.
const requireAdmin = () => requirePermission("settings.manage", "roles")

// Best-effort: a logging failure must never roll back the actual change, and
// 'role' only becomes a valid audit_entity once migration 0010 is applied.
async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  byUserId: string,
  roleId: string,
  label: string,
  action: string,
) {
  try {
    await supabase
      .from("audit_log")
      .insert({ entity: "role", entity_id: roleId, label, action, by_user_id: byUserId })
  } catch {
    // non-critical
  }
}

// "Client Care Lead" -> "client_care_lead"; the unique (firm_id, key) keeps it stable.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export async function createRole(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Enter a role name." }
  const key = slugify(name)
  if (!key) return { error: "Use letters or numbers in the role name." }

  const supabase = await createClient()
  // firm_id defaults to current_firm_id(); is_system defaults false (a custom role).
  const { data, error } = await supabase.from("roles").insert({ name, key }).select("id").single()
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "A role with that name already exists."
          : "Couldn't create the role.",
    }
  }

  await audit(supabase, gate.user.id, data.id, name, "created")
  revalidatePath(ROLES_PATH)
  return { ok: true }
}

export async function renameRole(roleId: string, formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Enter a role name." }

  const supabase = await createClient()
  // Custom roles only: the is_system filter makes renaming a system role a no-op
  // match (no rows) rather than relying on the UI to hide the control — system roles
  // stay locked, consistent with the guard's key/is_system/firm immutability.
  const { data, error } = await supabase
    .from("roles")
    .update({ name })
    .eq("id", roleId)
    .eq("is_system", false)
    .select("id")
  if (error) return { error: "Couldn't rename the role." }
  if (!data || data.length === 0) return { error: "That role can't be renamed." }

  await audit(supabase, gate.user.id, roleId, name, "renamed")
  revalidatePath(ROLES_PATH)
  return { ok: true }
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase.from("roles").delete().eq("id", roleId).select("id")
  if (error) {
    // The guard_system_role trigger raises for system roles and still-assigned roles.
    if (/system roles cannot be deleted/i.test(error.message)) {
      return { error: "System roles can't be deleted." }
    }
    if (/assigned users/i.test(error.message)) {
      return { error: "Remove this role from everyone who has it before deleting it." }
    }
    return { error: "Couldn't delete the role." }
  }
  // No row deleted = the role is already gone or outside the caller's firm
  // (RLS-hidden); don't report success or write a bogus audit entry.
  if (!data || data.length === 0) return { error: "That role couldn't be deleted." }

  await audit(supabase, gate.user.id, roleId, "", "deleted")
  revalidatePath(ROLES_PATH)
  return { ok: true }
}

export async function setRolePermissions(
  roleId: string,
  permissions: AppPermission[],
): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  // Never trust the client: keep only known vocabulary, de-duplicated.
  const valid = [...new Set(permissions.filter((p) => ALL_PERMISSIONS.includes(p)))]

  const supabase = await createClient()
  // Atomic replace via RPC so a failed re-insert can't leave the role with zero
  // permissions. The role_permissions RLS (firm-scoped, admin-only) is the gate.
  const { error } = await supabase.rpc("set_role_permissions", {
    p_role_id: roleId,
    p_permissions: valid,
  })
  if (error) return { error: "Couldn't update permissions." }

  await audit(supabase, gate.user.id, roleId, "", "permissions_updated")
  revalidatePath(ROLES_PATH)
  return { ok: true }
}
