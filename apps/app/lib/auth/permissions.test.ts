import { describe, expect, test } from "bun:test"

import type { Role } from "../../data/types"
import { can, type Permission } from "./permissions"

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
