"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session"
import { parseConsultationTypeInput } from "@/lib/consultations/consultation-types"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }

const PATH = "/settings/consultation-types"

// Types surface in Settings, the consultations page, and the lead detail's book-consultation dialog.
function revalidateTypeViews() {
  revalidatePath(PATH)
  revalidatePath("/consultations")
  revalidatePath("/leads/[id]", "page")
}

type Gate = { ok: true; user: CurrentUser } | { ok: false; error: string }

async function requireAdmin(): Promise<Gate> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "You're not signed in." }
  if (!user.firmId) return { ok: false, error: "Your session is missing firm context." }
  if (!(user.permissions?.includes("settings.manage") ?? false))
    return { ok: false, error: "You don't have permission to manage consultation types." }
  return { ok: true, user }
}

function readInput(formData: FormData) {
  return parseConsultationTypeInput({
    name: formData.get("name"),
    durationMin: formData.get("durationMin"),
    price: formData.get("price"),
  })
}

export async function createConsultationType(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const parsed = readInput(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  // Append after the last position. firm_id defaults to current_firm_id().
  const { data: last } = await supabase
    .from("consultation_types")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase
    .from("consultation_types")
    .insert({
      name: parsed.value.name,
      duration_min: parsed.value.durationMin,
      price: parsed.value.price,
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single()
  if (error) {
    return { error: error.code === "23505" ? "A type with that name already exists." : "Couldn't add the type." }
  }
  revalidateTypeViews()
  return { ok: true }
}

export async function editConsultationType(id: string, formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  const parsed = readInput(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("consultation_types")
    .update({
      name: parsed.value.name,
      duration_min: parsed.value.durationMin,
      price: parsed.value.price,
    })
    .eq("id", id)
    .select("id")
  if (error) {
    return { error: error.code === "23505" ? "A type with that name already exists." : "Couldn't save the type." }
  }
  if (!data || data.length === 0) return { error: "Couldn't save the type." }
  revalidateTypeViews()
  return { ok: true }
}

export async function setConsultationTypeActive(id: string, isActive: boolean): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("consultation_types")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id")
  if (error || !data || data.length === 0) return { error: "Couldn't update the type." }
  revalidateTypeViews()
  return { ok: true }
}

// Deleting a type is safe: consultations store the chosen name/duration/amount, so past records are
// unaffected. (Deactivate instead to keep it out of the picker while leaving it visible in Settings.)
export async function deleteConsultationType(id: string): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data, error } = await supabase.from("consultation_types").delete().eq("id", id).select("id")
  if (error || !data || data.length === 0) return { error: "Couldn't delete the type." }
  revalidateTypeViews()
  return { ok: true }
}

export async function reorderConsultationType(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }

  const supabase = await createClient()
  const { data: row } = await supabase.from("consultation_types").select("position").eq("id", id).single()
  if (!row) return { error: "Couldn't reorder." }

  const base = supabase.from("consultation_types").select("id, position")
  const filtered = direction === "up" ? base.lt("position", row.position) : base.gt("position", row.position)
  const { data: neighbor } = await filtered
    .order("position", { ascending: direction === "down" })
    .limit(1)
    .maybeSingle()
  if (!neighbor) return { ok: true } // already at the edge

  // Swap positions (two updates; admin-only + rare, so non-atomicity is fine — position isn't unique).
  const swap1 = await supabase.from("consultation_types").update({ position: neighbor.position }).eq("id", id)
  if (swap1.error) return { error: "Couldn't reorder." }
  const swap2 = await supabase.from("consultation_types").update({ position: row.position }).eq("id", neighbor.id)
  if (swap2.error) return { error: "Couldn't reorder." }
  revalidateTypeViews()
  return { ok: true }
}
