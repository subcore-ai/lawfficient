// Canonical authorization matrix — the single source of truth for both server
// and client. Pure functions (no React), safe to import anywhere.
// UI uses this to hide controls; RLS in the database is the real enforcement.
import type { AppPermission } from "@/lib/rbac/permissions"
import type { Role } from "@/data/types"

export type Permission = "edit" | "delete" | "editFinancial" | "manageUsers"

export function can(role: Role, action: Permission): boolean {
  if (role === "admin") return true
  switch (action) {
    case "edit":
      return role !== "file_clerk"
    case "delete":
      return role === "la_lead"
    case "editFinancial":
      return role === "accounts_receivable"
    case "manageUsers":
      return false
  }
}

// RBAC permission check for UI gating. Once the access-token hook stamps the user's
// permissions into the JWT (app_metadata.permissions), use them; until then
// (permissions === null) fall back to the role-based can() matrix so the UI is
// unchanged before enforcement goes live. UI gating is cosmetic — RLS is the real
// enforcement. A missing `permission` (unmapped action) also falls back to can().
export function hasPermission(
  permissions: readonly AppPermission[] | null,
  role: Role,
  permission: AppPermission | undefined,
  fallbackAction: Permission,
): boolean {
  if (permissions != null && permission != null) return permissions.includes(permission)
  return can(role, fallbackAction)
}
