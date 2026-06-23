// Note view model: maps a DB row (+ a firm name-map for the author) into one shape the timeline
// consumes. Generic over the entity it's attached to (leads today; clients/cases later) — see
// migration 0028. Pure + unit-tested.
import type { Database } from "@/lib/supabase/database.types"

type NoteRow = Database["public"]["Tables"]["notes"]["Row"]

// Entities that can carry notes. Extend as modules go real (mirrors the 0028 entity_type check).
export type NoteEntityType = "lead"

export type NoteView = {
  id: string
  entityType: string
  entityId: string
  kind: "note" | "event"
  body: string
  authorId: string | null
  authorName: string
  createdAt: string
  editedAt: string | null
  resolvedAt: string | null
  resolvedById: string | null
  hiddenAt: string | null
  hiddenById: string | null
}

// Resolve the author's display name from a firm-wide profiles map (id -> name), the same way the
// lead page resolves assignees. Falls back to "Unknown" for a departed/unloaded author.
export function mapNoteRow(
  row: NoteRow,
  namesById: Map<string, string>
): NoteView {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    kind: row.kind === "event" ? "event" : "note",
    body: row.body,
    authorId: row.created_by_id,
    authorName: row.created_by_id
      ? (namesById.get(row.created_by_id) ?? "Unknown")
      : "Unknown",
    createdAt: row.created_at,
    editedAt: row.edited_at,
    resolvedAt: row.resolved_at,
    resolvedById: row.resolved_by_id,
    hiddenAt: row.hidden_at,
    hiddenById: row.hidden_by_id,
  }
}

// Split notes for display: hidden entries are filtered out unless showHidden (but always counted so
// the UI can offer a "Show N hidden" toggle). Open vs addressed (resolvedAt set) is handled in the
// component — addressed notes render collapsed. Input is expected newest-first.
export function partitionNotes(
  notes: NoteView[],
  opts: { showHidden: boolean }
): { visible: NoteView[]; hiddenCount: number } {
  const hiddenCount = notes.reduce((n, note) => n + (note.hiddenAt ? 1 : 0), 0)
  const visible = opts.showHidden
    ? notes
    : notes.filter((note) => !note.hiddenAt)
  return { visible, hiddenCount }
}
