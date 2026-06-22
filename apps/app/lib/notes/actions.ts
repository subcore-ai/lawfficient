"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import type { NoteEntityType } from "@/lib/notes/queries"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }
type NotesClient = Awaited<ReturnType<typeof createClient>>

// Detail paths that render a given entity's notes — revalidated after a note mutation. Extend as
// other entities adopt notes (mirrors the 0028 entity_type set + the RLS policies).
const ENTITY_PATHS: Record<NoteEntityType, (entityId: string) => string[]> = {
  lead: (id) => [`/leads/${id}`],
}

function revalidateEntity(entityType: string, entityId: string) {
  for (const path of ENTITY_PATHS[entityType as NoteEntityType]?.(entityId) ??
    [])
    revalidatePath(path)
}

// Notes ride on the parent entity's permissions: writing requires that entity's edit permission.
// v1 is leads-only, so this is leads.edit (extended per entity alongside the RLS policies). RLS is
// the real enforcement; this returns a clean error first.
async function requireNotesEdit(): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!(user.permissions?.includes("leads.edit") ?? false))
    return { ok: false, error: "You don't have permission to manage notes." }
  return { ok: true, user }
}

// Best-effort audit under the PARENT entity (entity='lead'), so a lead's history stays in one place.
async function audit(
  supabase: NotesClient,
  byUserId: string,
  entityId: string,
  label: string,
  action: string
) {
  try {
    const { error } = await supabase
      .from("audit_log")
      .insert({
        entity: "lead",
        entity_id: entityId,
        label,
        action,
        by_user_id: byUserId,
      })
    if (error) console.error("audit_log insert failed:", error.message)
  } catch (err) {
    console.error("audit_log insert threw:", err)
  }
}

const preview = (body: string) => body.trim().slice(0, 80)

export async function addNote(
  entityType: NoteEntityType,
  entityId: string,
  body: string
): Promise<ActionResult> {
  const gate = await requireNotesEdit()
  if (!gate.ok) return { error: gate.error }
  if (!(entityType in ENTITY_PATHS))
    return { error: "Unsupported note target." }
  const text = body.trim()
  if (!text) return { error: "Write something first." }

  const supabase = await createClient()
  // created_by_id must equal auth.uid() — the RLS insert check pins the author so it can't be forged.
  const { data: inserted, error } = await supabase
    .from("notes")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      body: text,
      created_by_id: gate.user.id,
    })
    .select("id")
    .single()
  if (error || !inserted) return { error: "Couldn't add the note." }

  await audit(supabase, gate.user.id, entityId, preview(text), "note_added")
  revalidateEntity(entityType, entityId)
  return { ok: true }
}

export async function editNote(
  id: string,
  body: string
): Promise<ActionResult> {
  const gate = await requireNotesEdit()
  if (!gate.ok) return { error: gate.error }
  const text = body.trim()
  if (!text) return { error: "Write something first." }

  const supabase = await createClient()
  // Body-edit is author-only. RLS lets any leads.edit holder update a note (so they can address/hide
  // it), so ownership is enforced here.
  const { data: note, error: readErr } = await supabase
    .from("notes")
    .select("entity_type, entity_id, created_by_id")
    .eq("id", id)
    .single()
  if (readErr || !note) return { error: "Couldn't find that note." }
  if (note.created_by_id !== gate.user.id)
    return { error: "You can only edit your own notes." }

  // .select().single() makes a 0-row update (RLS / wrong id) a real error, not a silent ok.
  const { data: updated, error } = await supabase
    .from("notes")
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single()
  if (error || !updated) return { error: "Couldn't save the note." }

  await audit(
    supabase,
    gate.user.id,
    note.entity_id,
    preview(text),
    "note_edited"
  )
  revalidateEntity(note.entity_type, note.entity_id)
  return { ok: true }
}

export async function setNoteResolved(
  id: string,
  resolved: boolean
): Promise<ActionResult> {
  const gate = await requireNotesEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from("notes")
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by_id: resolved ? gate.user.id : null,
    })
    .eq("id", id)
    .select("entity_type, entity_id")
    .single()
  if (error || !updated) return { error: "Couldn't update the note." }

  await audit(
    supabase,
    gate.user.id,
    updated.entity_id,
    "",
    resolved ? "note_resolved" : "note_reopened"
  )
  revalidateEntity(updated.entity_type, updated.entity_id)
  return { ok: true }
}

export async function setNoteHidden(
  id: string,
  hidden: boolean
): Promise<ActionResult> {
  const gate = await requireNotesEdit()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from("notes")
    .update({
      hidden_at: hidden ? new Date().toISOString() : null,
      hidden_by_id: hidden ? gate.user.id : null,
    })
    .eq("id", id)
    .select("entity_type, entity_id")
    .single()
  if (error || !updated) return { error: "Couldn't update the note." }

  await audit(
    supabase,
    gate.user.id,
    updated.entity_id,
    "",
    hidden ? "note_hidden" : "note_unhidden"
  )
  revalidateEntity(updated.entity_type, updated.entity_id)
  return { ok: true }
}

export async function deleteNote(id: string): Promise<ActionResult> {
  // Signed-in is enough at the gate; the RLS delete policy enforces author-or-admin.
  const user = await getCurrentUser()
  if (!user) return { error: "You're not signed in." }

  const supabase = await createClient()
  const { data: deleted, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .select("entity_type, entity_id")
    .single()
  if (error || !deleted)
    return { error: "You can only delete your own notes, or ask an admin." }

  await audit(supabase, user.id, deleted.entity_id, "", "note_deleted")
  revalidateEntity(deleted.entity_type, deleted.entity_id)
  return { ok: true }
}
