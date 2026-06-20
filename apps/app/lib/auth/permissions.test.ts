import { describe, expect, test } from "bun:test"

import type { Role } from "../../data/types"
import { can, hasPermission, type Permission } from "./permissions"
import type { AppPermission } from "../rbac/permissions"

// Every staff role, so each case below is exhaustive over the matrix.
const ROLES: Role[] = [
  "admin",
  "attorney",
  "la_lead",
  "legal_assistant",
  "qa_lead",
  "creative_writer",
  "sales",
  "accounts_receivable",
  "file_clerk",
]

describe("can() — authorization matrix", () => {
  test("admin can do everything", () => {
    const perms: Permission[] = ["edit", "delete", "editFinancial", "manageUsers"]
    for (const p of perms) expect(can("admin", p)).toBe(true)
  })

  test("manageUsers is admin-only", () => {
    for (const role of ROLES) {
      expect(can(role, "manageUsers")).toBe(role === "admin")
    }
  })

  test("editFinancial is limited to admin and accounts_receivable", () => {
    for (const role of ROLES) {
      expect(can(role, "editFinancial")).toBe(role === "admin" || role === "accounts_receivable")
    }
  })

  test("delete is limited to admin and la_lead", () => {
    for (const role of ROLES) {
      expect(can(role, "delete")).toBe(role === "admin" || role === "la_lead")
    }
  })

  test("edit is allowed for everyone except file_clerk", () => {
    for (const role of ROLES) {
      expect(can(role, "edit")).toBe(role !== "file_clerk")
    }
  })
})

describe("hasPermission() — RBAC gating (transition-safe)", () => {
  const LEADS_EDIT: AppPermission = "leads.edit"

  test("falls back to can() when permissions aren't stamped (null)", () => {
    for (const role of ROLES) {
      expect(hasPermission(null, role, LEADS_EDIT, "edit")).toBe(can(role, "edit"))
    }
  })

  test("stamped permissions are authoritative, not the role", () => {
    // file_clerk can't "edit" via the matrix, but a stamped leads.edit grants it.
    expect(hasPermission([LEADS_EDIT], "file_clerk", LEADS_EDIT, "edit")).toBe(true)
    // admin can "edit" via the matrix, but a stamped set without leads.edit denies it.
    expect(hasPermission(["clients.view"], "admin", LEADS_EDIT, "edit")).toBe(false)
  })

  test("an empty stamped set denies (no roles assigned)", () => {
    expect(hasPermission([], "admin", LEADS_EDIT, "edit")).toBe(false)
  })

  test("an unmapped permission falls back to can() even when stamped", () => {
    for (const role of ROLES) {
      expect(hasPermission([LEADS_EDIT], role, undefined, "delete")).toBe(can(role, "delete"))
    }
  })
})
