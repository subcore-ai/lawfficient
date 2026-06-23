import { describe, expect, test } from "bun:test"

import type { Database } from "@/lib/supabase/database.types"

import { mapNoteRow, partitionNotes, type NoteView } from "./queries"

type NoteRow = Database["public"]["Tables"]["notes"]["Row"]

function row(overrides: Partial<NoteRow> = {}): NoteRow {
  return {
    id: "n1",
    firm_id: "f1",
    entity_type: "lead",
    entity_id: "l1",
    kind: "note",
    body: "Called, left a voicemail",
    created_by_id: "u1",
    created_at: "2026-06-20T15:00:00Z",
    edited_at: null,
    resolved_at: null,
    resolved_by_id: null,
    hidden_at: null,
    hidden_by_id: null,
    ...overrides,
  }
}

describe("mapNoteRow", () => {
  const names = new Map([["u1", "Ada Lovelace"]])

  test("resolves the author name from the firm name-map", () => {
    expect(mapNoteRow(row(), names).authorName).toBe("Ada Lovelace")
  })

  test("falls back to Unknown for a null or unmapped author", () => {
    expect(mapNoteRow(row({ created_by_id: null }), names).authorName).toBe(
      "Unknown"
    )
    expect(mapNoteRow(row({ created_by_id: "ghost" }), names).authorName).toBe(
      "Unknown"
    )
  })

  test("carries the lifecycle timestamps through", () => {
    const v = mapNoteRow(
      row({
        resolved_at: "2026-06-21T00:00:00Z",
        edited_at: "2026-06-20T16:00:00Z",
      }),
      names
    )
    expect(v.resolvedAt).toBe("2026-06-21T00:00:00Z")
    expect(v.editedAt).toBe("2026-06-20T16:00:00Z")
    expect(v.hiddenAt).toBeNull()
  })

  test("maps the kind (note vs event)", () => {
    expect(mapNoteRow(row(), names).kind).toBe("note")
    expect(mapNoteRow(row({ kind: "event" }), names).kind).toBe("event")
  })
})

describe("partitionNotes", () => {
  const note = (id: string, hidden: boolean): NoteView => ({
    id,
    entityType: "lead",
    entityId: "l1",
    kind: "note",
    body: "x",
    authorId: "u1",
    authorName: "Ada",
    createdAt: "2026-06-20T15:00:00Z",
    editedAt: null,
    resolvedAt: null,
    resolvedById: null,
    hiddenAt: hidden ? "2026-06-20T16:00:00Z" : null,
    hiddenById: null,
  })

  test("hides hidden notes by default but always counts them", () => {
    const { visible, hiddenCount } = partitionNotes(
      [note("a", false), note("b", true)],
      { showHidden: false }
    )
    expect(visible.map((n) => n.id)).toEqual(["a"])
    expect(hiddenCount).toBe(1)
  })

  test("includes hidden notes when showHidden is on", () => {
    const { visible, hiddenCount } = partitionNotes(
      [note("a", false), note("b", true)],
      { showHidden: true }
    )
    expect(visible.map((n) => n.id)).toEqual(["a", "b"])
    expect(hiddenCount).toBe(1)
  })
})
