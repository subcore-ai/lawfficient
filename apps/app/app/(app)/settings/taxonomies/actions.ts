"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { requirePermission } from "@/lib/auth/gate"
import { taxonomiesTag } from "@/lib/reference"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { TAXONOMY_CATEGORIES, type TaxonomyCategory } from "@/lib/taxonomies/queries"

export type ActionResult = { ok: true } | { error: string }
// Inline create returns the new id + label so the dropdown can auto-select it.
export type CreateResult = { ok: true; id: string; label: string } | { error: string }

const PATH = "/settings/taxonomies"

// Taxonomy values surface in Settings, the leads board, and the dashboard quick-add — revalidate all.
function revalidateTaxonomyViews(firmId: string) {
  revalidateTag(taxonomiesTag(firmId), { expire: 0 }) // purge the per-firm taxonomy cache (lib/reference.ts)
  revalidatePath(PATH)
  revalidatePath("/")
  revalidatePath("/leads")
  revalidatePath("/leads/[id]", "page") // lead detail (dynamic) — its edit dialog uses the vocab
}

type DbClient = Awaited<ReturnType<typeof createClient>>

// RLS (authorize('settings.manage'), firm-scoped) is the real gate; this returns a clean error first.
const requireAdmin = () => requirePermission("settings.manage", "taxonomies")

async function audit(supabase: DbClient, byUserId: string, id: string, label: string, action: string) {
  try {
    await supabase
      .from("audit_log")
      .insert({ entity: "taxonomy", entity_id: id, label, action, by_user_id: byUserId })
  } catch {
    // best-effort
  }
}

function isCategory(v: unknown): v is TaxonomyCategory {
  return typeof v === "string" && (TAXONOMY_CATEGORIES as string[]).includes(v)
}

// The leads.data jsonb key a category maps to (for the in-use check).
function dataKey(category: TaxonomyCategory): string {
  return category === "case_type" ? "caseType" : category === "case_hierarchy" ? "hierarchy" : "qualification"
}

// Shared create — used by the settings dialog (with notes) and the inline "+ new" in the lead form.
async function insertTaxonomy(category: TaxonomyCategory, label: string, notes: string | null): Promise<CreateResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const trimmed = label.trim()
  if (!trimmed) return { error: "Enter a value." }
  if (trimmed.startsWith("__")) return { error: "Values can't start with “__” (reserved)." }

  const supabase = await createClient()
  // Append after the last position in this category. firm_id defaults to current_firm_id().
  const { data: last } = await supabase
    .from("firm_taxonomies")
    .select("position")
    .eq("category", category)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from("firm_taxonomies")
    .insert({ category, label: trimmed, notes: notes?.trim() || null, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single()
  if (error || !data) {
    return { error: error?.code === "23505" ? "That value already exists." : "Couldn't add the value." }
  }

  await audit(supabase, gate.user.id, data.id, trimmed, "created")
  revalidateTaxonomyViews(gate.user.firmId)
  return { ok: true, id: data.id, label: trimmed }
}

export async function createTaxonomy(category: string, formData: FormData): Promise<ActionResult> {
  if (!isCategory(category)) return { error: "Unknown category." }
  const res = await insertTaxonomy(category, String(formData.get("label") ?? ""), String(formData.get("notes") ?? ""))
  return "error" in res ? { error: res.error } : { ok: true }
}

export async function createTaxonomyInline(category: string, label: string): Promise<CreateResult> {
  if (!isCategory(category)) return { error: "Unknown category." }
  return insertTaxonomy(category, label, null)
}

// Label rename is custom-only (re-points existing leads via the RPC); notes is editable on any row.
export async function editTaxonomy(id: string, formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const label = String(formData.get("label") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim() || null
  if (!label) return { error: "Enter a value." }
  if (label.startsWith("__")) return { error: "Values can't start with “__” (reserved)." }

  const supabase = await createClient()
  const { data: row, error: readErr } = await supabase
    .from("firm_taxonomies")
    .select("label, is_system")
    .eq("id", id)
    .single()
  if (readErr || !row) return { error: "Couldn't update the value." }

  if (label !== row.label) {
    if (row.is_system) return { error: "System values can't be renamed (you can still edit their notes)." }
    // One transaction: label + notes + the leads bulk-rewrite (SECURITY DEFINER RPC; re-checks firm).
    const { error } = await supabase.rpc("rename_firm_taxonomy", { p_id: id, p_label: label, p_notes: notes ?? "" })
    if (error) {
      return {
        error: /duplicate|unique|23505/i.test(error.message) ? "That value already exists." : "Couldn't rename the value.",
      }
    }
  } else {
    // Notes-only edit (label unchanged) — a plain update is fine.
    const { data: updated, error: notesErr } = await supabase
      .from("firm_taxonomies")
      .update({ notes })
      .eq("id", id)
      .select("id")
    if (notesErr || !updated || updated.length === 0) return { error: "Couldn't save the value." }
  }

  await audit(supabase, gate.user.id, id, label, "updated")
  revalidateTaxonomyViews(gate.user.firmId)
  return { ok: true }
}

export async function setTaxonomyActive(id: string, isActive: boolean): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("firm_taxonomies")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id, label")
  if (error || !data || data.length === 0) return { error: "Couldn't update the value." }

  await audit(supabase, gate.user.id, id, data[0]!.label, isActive ? "activated" : "deactivated")
  revalidateTaxonomyViews(gate.user.firmId)
  return { ok: true }
}

// Persist a full drag-and-drop reordering: `orderedIds` is every row in the category, in the new order.
export async function reorderTaxonomies(category: string, orderedIds: string[]): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  if (!isCategory(category)) return { error: "Unknown category." }
  if (orderedIds.length === 0) return { ok: true }

  const supabase = await createClient()
  // The ids must be EXACTLY this category's rows (a complete permutation). RLS scopes to the firm; this also
  // rejects a stale list (a value added/removed in another tab) so we never persist a partial order.
  const { data: rows, error: readErr } = await supabase.from("firm_taxonomies").select("id").eq("category", category)
  if (readErr || !rows) return { error: "Couldn't reorder." }
  const known = new Set(rows.map((r) => r.id))
  const complete = orderedIds.length === known.size && orderedIds.every((id) => known.has(id))
  if (!complete) return { error: "The list changed — refresh and try again." }

  // Write each row's position to its new index. Sequential updates (admin-only + rare; position isn't unique).
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from("firm_taxonomies").update({ position: i }).eq("id", orderedIds[i]!)
    if (error) return { error: "Couldn't reorder." }
  }
  revalidateTaxonomyViews(gate.user.firmId)
  return { ok: true }
}

export async function deleteTaxonomy(id: string): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from("firm_taxonomies")
    .select("firm_id, category, label, is_system")
    .eq("id", id)
    .single()
  if (!row) return { error: "That value couldn't be deleted." }
  if (row.is_system) return { error: "System values can't be deleted (you can deactivate them)." }

  // Authoritative in-use check via the service-role client: the guard's scan runs under leads RLS,
  // which a settings-only admin may not satisfy, and labels are denormalized in leads.data.
  const admin = createAdminClient()
  const { count, error: countErr } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", row.firm_id)
    .eq(`data->>${dataKey(row.category as TaxonomyCategory)}`, row.label)
  // Fail safe: if we can't verify usage, don't risk deleting an in-use value.
  if (countErr) return { error: "Couldn't verify whether the value is in use. Try again." }
  if ((count ?? 0) > 0) {
    return { error: "This value is in use by leads. Deactivate it instead, or re-tag those leads first." }
  }

  const { data, error } = await supabase.from("firm_taxonomies").delete().eq("id", id).select("id")
  if (error || !data || data.length === 0) return { error: "Couldn't delete the value." }

  await audit(supabase, gate.user.id, id, row.label, "deleted")
  revalidateTaxonomyViews(gate.user.firmId)
  return { ok: true }
}
