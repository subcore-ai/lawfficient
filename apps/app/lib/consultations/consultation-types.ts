// Firm-configurable consultation types (migration 0042): a named appointment type bundling a default
// duration + price. Booking picks one and auto-fills those; the slot engine offers slots of its length.
// "Chargeable" is just price > 0 — there's no separate paid flag (the consultation's own `paid` tracks
// payment status, a different concept). Pure view-model + input validation, shared by Settings + booking.
import type { Database } from "@/lib/supabase/database.types"

type ConsultationTypeRow = Database["public"]["Tables"]["consultation_types"]["Row"]

export type ConsultationType = {
  id: string
  name: string
  durationMin: number
  price: number
  position: number
  isActive: boolean
}

export function mapConsultationTypeRow(row: ConsultationTypeRow): ConsultationType {
  return {
    id: row.id,
    name: row.name,
    durationMin: row.duration_min,
    price: Number(row.price), // numeric arrives as a JS number; Number() is a no-op guard for string drivers
    position: row.position,
    isActive: row.is_active,
  }
}

export type ConsultationTypeInput = {
  name: string
  durationMin: number
  price: number
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

// Validate a type submitted from the Settings editor. Mirrors the 0042 column checks.
export function parseConsultationTypeInput(raw: {
  name?: unknown
  durationMin?: unknown
  price?: unknown
}): { ok: true; value: ConsultationTypeInput } | { ok: false; error: string } {
  const name = str(raw.name)
  if (!name) return { ok: false, error: "Enter a name." }

  const durationMin = typeof raw.durationMin === "number" ? raw.durationMin : Number(str(raw.durationMin))
  if (!Number.isInteger(durationMin) || durationMin <= 0 || durationMin > 1440) {
    return { ok: false, error: "Duration must be between 1 and 1440 minutes." }
  }

  let price = 0
  if (raw.price != null && raw.price !== "") {
    price = typeof raw.price === "number" ? raw.price : Number(str(raw.price))
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: "Price must be a non-negative number." }
    }
  }

  return { ok: true, value: { name, durationMin, price } }
}
