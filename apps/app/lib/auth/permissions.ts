// Canonical authorization matrix — the single source of truth for both server
// and client. Pure functions (no React), safe to import anywhere.
// UI uses this to hide controls; RLS in the database is the real enforcement.
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
