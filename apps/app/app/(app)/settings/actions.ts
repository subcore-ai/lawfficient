"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/auth/session"
import { isFirmTimezone } from "@/lib/firm/timezones"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = { ok: true } | { error: string }

const SETTINGS_PATH = "/settings"
const MAX = { name: 200, email: 254, phone: 40, language: 60, address: 300 }

// Trim a form value; empty becomes null so we don't store blank strings.
function field(formData: FormData, key: string, max: number): string | null {
  const v = String(formData.get(key) ?? "").trim()
  return v.length === 0 ? null : v.slice(0, max)
}

// Update the firm profile (Settings → General). Editing is admin-only — gated here
// for a friendly error AND by the firms_admin_update RLS policy (migration 0033).
export async function updateFirmProfile(formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser()
  if (!me) return { error: "You're not signed in." }
  if (!(me.permissions?.includes("settings.manage") ?? false)) {
    return { error: "Only admins can edit the firm profile." }
  }

  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Firm name is required." }
  if (name.length > MAX.name) return { error: `Firm name must be ${MAX.name} characters or fewer.` }

  const contactEmail = field(formData, "contactEmail", MAX.email)
  if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    return { error: "Enter a valid contact email." }
  }

  const timezone = String(formData.get("timezone") ?? "").trim() || null
  if (timezone && !isFirmTimezone(timezone)) return { error: "Pick a time zone from the list." }

  const feeRaw = String(formData.get("consultationFee") ?? "").trim()
  let consultationFee: number | null = null
  if (feeRaw.length > 0) {
    const n = Number(feeRaw)
    if (!Number.isInteger(n) || n < 0) {
      return { error: "Consultation fee must be a whole dollar amount." }
    }
    consultationFee = n
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("firms")
    .update({
      name,
      contact_email: contactEmail,
      phone: field(formData, "phone", MAX.phone),
      timezone,
      default_language: field(formData, "language", MAX.language),
      consultation_fee: consultationFee,
      office_address: field(formData, "address", MAX.address),
    })
    .eq("id", me.firmId)
  if (error) return { error: "Couldn't save the firm profile. Please try again." }

  revalidatePath(SETTINGS_PATH)
  // The app shell brand isn't firm-driven yet, so no layout revalidate is needed.
  return { ok: true }
}
