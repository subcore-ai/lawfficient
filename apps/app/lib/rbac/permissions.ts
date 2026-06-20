import type { Database } from "@/lib/supabase/database.types"

/** One permission in the controlled vocabulary (mirrors the app_permission enum, migration 0008). */
export type AppPermission = Database["public"]["Enums"]["app_permission"]

export type PermissionGroup = {
  /** Module display label. */
  module: string
  permissions: { key: AppPermission; label: string }[]
}

/**
 * The permission vocabulary grouped by module — drives the role editor's matrix.
 * Mirrors the app_permission enum (migration 0008): adding a permission means a
 * migration AND an entry here. The `key: AppPermission` typing keeps them honest —
 * a key dropped from the enum stops type-checking here.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { module: "Dashboard", permissions: [{ key: "dashboard.view", label: "View" }] },
  {
    module: "Leads",
    permissions: [
      { key: "leads.view", label: "View" },
      { key: "leads.edit", label: "Edit" },
    ],
  },
  {
    module: "Consultations",
    permissions: [
      { key: "consultations.view", label: "View" },
      { key: "consultations.edit", label: "Edit" },
    ],
  },
  {
    module: "Clients",
    permissions: [
      { key: "clients.view", label: "View" },
      { key: "clients.edit", label: "Edit" },
    ],
  },
  {
    module: "Cases",
    permissions: [
      { key: "cases.view", label: "View" },
      { key: "cases.edit", label: "Edit" },
    ],
  },
  {
    module: "Documents",
    permissions: [
      { key: "documents.view", label: "View" },
      { key: "documents.edit", label: "Edit" },
    ],
  },
  {
    module: "Billing",
    permissions: [
      { key: "billing.view", label: "View" },
      { key: "billing.view_status", label: "View status only" },
      { key: "billing.edit", label: "Edit" },
    ],
  },
  {
    module: "Reporting",
    permissions: [
      { key: "reporting.view", label: "View" },
      { key: "reporting.edit", label: "Edit" },
    ],
  },
  {
    module: "Administration",
    permissions: [
      { key: "users.manage", label: "Manage users" },
      { key: "settings.manage", label: "Manage settings & roles" },
    ],
  },
]

/** Flat list of every valid permission key — used to validate incoming sets server-side. */
export const ALL_PERMISSIONS: AppPermission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
)
