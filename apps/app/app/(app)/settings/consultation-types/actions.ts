"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth/gate"
import { parseConsultationTypeInput } from "@/lib/consultations/consultation-types"
import { createClient } from "@/lib/supabase/server"

import type { ActionResult } from "@/lib/actions/result"

const PATH = "/settings/consultation-types"

// Types surface in Settings, the consultations page, and the lead detail's book-consultation dialog.
function revalidateTypeViews() {
  revalidatePath(PATH)
  revalidatePath("/consultations")
  revalidatePath("/leads/[id]", "page")
}

// RLS (authorize('settings.manage'), firm-scoped) is the real gate; this returns a clean error first.
const requireAdmin = () => requirePermission("settings.manage", "consultation types")

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
  // Append after the last position. firm_id defaults to current_firm_id(). position is a soft ordering
  // hint (not unique): readers sort by (position, created_at), so a concurrent append at the same
  // position still renders in a stable order.
  const { data: last, error: posErr } = await supabase
    .from("consultation_types")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (posErr) return { error: "Couldn't add the type." }

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
