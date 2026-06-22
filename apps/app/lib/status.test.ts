import { describe, expect, test } from "bun:test"

import type { Deadline } from "../data/types"
import {
  caseStatusBadge,
  clientStatusBadge,
  consultationStatusBadge,
  deadlineBadge,
  invoiceStatusBadge,
  leadStatusBadge,
  paymentStatusBadge,
  priorityBadge,
  qualificationBadge,
  redFlagBadge,
} from "./status"

describe("enum → badge mappers", () => {
  test("map representative values to their label + tone", () => {
    expect(leadStatusBadge("retained")).toEqual({ label: "Retained", tone: "success" })
    expect(qualificationBadge("Qualified")).toEqual({ label: "Qualified", tone: "success" })
    expect(qualificationBadge("Custom value")).toEqual({ label: "Custom value", tone: "neutral" })
    expect(consultationStatusBadge("no_show")).toEqual({ label: "No-show", tone: "danger" })
    expect(caseStatusBadge("rfe")).toEqual({ label: "RFE / NOID", tone: "danger" })
    expect(invoiceStatusBadge("overdue")).toEqual({ label: "Overdue", tone: "danger" })
    expect(clientStatusBadge("monthly_plan")).toEqual({ label: "Monthly plan", tone: "info" })
    expect(paymentStatusBadge("payment_arrangement")).toEqual({ label: "Arrangement", tone: "warning" })
    expect(priorityBadge("urgent")).toEqual({ label: "Urgent", tone: "danger" })
  })
})

describe("redFlagBadge", () => {
  test("returns null for 'none' and a danger badge for either flag", () => {
    expect(redFlagBadge("none")).toBeNull()
    expect(redFlagBadge("red_flag_client")).toEqual({ label: "Red Flag Client", tone: "danger" })
    expect(redFlagBadge("red_flag_packet")).toEqual({ label: "Red Flag Packet", tone: "danger" })
  })
})

describe("deadlineBadge", () => {
  const at = (status: Deadline["status"], dueInDays: number): Deadline => ({
    id: "d1",
    caseId: "c1",
    clientName: "Test Client",
    kind: "RFE",
    dueAt: "2026-06-30",
    dueInDays,
    laId: "u1",
    attorneyId: "u2",
    status,
  })

  test("overdue by status → 'Nd overdue', danger", () => {
    expect(deadlineBadge(at("overdue", 3))).toEqual({ label: "3d overdue", tone: "danger" })
  })

  test("negative days count as overdue (absolute value) even when status is not 'overdue'", () => {
    expect(deadlineBadge(at("open", -5))).toEqual({ label: "5d overdue", tone: "danger" })
  })

  test("due within two days (including today) → danger", () => {
    expect(deadlineBadge(at("open", 0))).toEqual({ label: "Due in 0d", tone: "danger" })
    expect(deadlineBadge(at("open", 2))).toEqual({ label: "Due in 2d", tone: "danger" })
  })

  test("due within a week (3–7 days) → warning", () => {
    expect(deadlineBadge(at("open", 3))).toEqual({ label: "Due in 3d", tone: "warning" })
    expect(deadlineBadge(at("open", 7))).toEqual({ label: "Due in 7d", tone: "warning" })
  })

  test("further out (> 7 days) → info", () => {
    expect(deadlineBadge(at("open", 8))).toEqual({ label: "Due in 8d", tone: "info" })
    expect(deadlineBadge(at("open", 45))).toEqual({ label: "Due in 45d", tone: "info" })
  })

  // A "responded" deadline currently falls through to the due-date thresholds,
  // exactly like "open". Whether it should be suppressed/neutral is a product
  // decision; this pins the current behavior.
  test("'responded' is treated like 'open' (current behavior)", () => {
    expect(deadlineBadge(at("responded", 1))).toEqual({ label: "Due in 1d", tone: "danger" })
  })
})
