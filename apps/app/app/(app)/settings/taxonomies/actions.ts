"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { TAXONOMY_CATEGORIES, type TaxonomyCategory } from "@/lib/taxonomies/queries"

export type ActionResult = { ok: true } | { error: string }
// Inline create returns the new id + label so the dropdown can auto-select it.
export type CreateResult = { ok: true; id: string; label: string } | { error: string }

const PATH = "/settings/taxonomies"

// Taxonomy values surface in Settings, the leads board, and the dashboard quick-add — revalidate all.
function revalidateTaxonomyViews() {
  revalidatePath(PATH)
  revalidatePath("/")
  revalidatePath("/leads")
}

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }
type DbClient = Awaited<ReturnType<typeof createClient>>

// RLS (authorize('settings.manage'), firm-scoped) is the real gate; this returns a clean error first.
async function requireAdmin(): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!(user.permissions?.includes("settings.manage") ?? false))
    return { ok: false, error: "You don't have permission to manage taxonomies." }
  return { ok: true, user }
}

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
  revalidateTaxonomyViews()
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
    // Rename + bulk-update every lead carrying the old label (SECURITY DEFINER RPC; re-checks firm).
    const { error } = await supabase.rpc("rename_firm_taxonomy", { p_id: id, p_label: label })
    if (error) {
      return {
        error: /duplicate|unique|23505/i.test(error.message) ? "That value already exists." : "Couldn't rename the value.",
      }
    }
  }

  const { data: updated, error: notesErr } = await supabase
    .from("firm_taxonomies")
    .update({ notes })
    .eq("id", id)
    .select("id")
  if (notesErr || !updated || updated.length === 0) return { error: "Couldn't save the value." }

  await audit(supabase, gate.user.id, id, label, "updated")
  revalidateTaxonomyViews()
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
  revalidateTaxonomyViews()
  return { ok: true }
}

export async function reorderTaxonomy(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from("firm_taxonomies")
    .select("category, position")
    .eq("id", id)
    .single()
  if (!row) return { error: "Couldn't reorder." }

  // The adjacent row in the same category to swap positions with.
  const base = supabase.from("firm_taxonomies").select("id, position").eq("category", row.category)
  const filtered = direction === "up" ? base.lt("position", row.position) : base.gt("position", row.position)
  const { data: neighbor } = await filtered
    .order("position", { ascending: direction === "down" })
    .limit(1)
    .maybeSingle()
  if (!neighbor) return { ok: true } // already at the edge — no-op

  // Swap positions (two updates; admin-only + rare, so non-atomicity is fine — position isn't unique).
  const swap1 = await supabase.from("firm_taxonomies").update({ position: neighbor.position }).eq("id", id)
  if (swap1.error) return { error: "Couldn't reorder." }
  const swap2 = await supabase.from("firm_taxonomies").update({ position: row.position }).eq("id", neighbor.id)
  if (swap2.error) return { error: "Couldn't reorder." }
  revalidateTaxonomyViews()
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
  revalidateTaxonomyViews()
  return { ok: true }
}
