import { redirect } from "next/navigation"

import { GeneralForm, type FirmProfile } from "@/components/settings/general-form"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Settings · General" }

export default async function SettingsGeneralPage() {
  const me = await getCurrentUser()
  if (!me) redirect("/login")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("firms")
    .select("name, contact_email, phone, timezone, default_language, consultation_fee, office_address")
    .eq("id", me.firmId)
    .maybeSingle()
  // Surface RLS/network failures via the error boundary rather than rendering the form with empty
  // defaults — which an admin could then save and overwrite real profile fields with nulls.
  if (error) throw error

  const row = data as {
    name: string
    contact_email: string | null
    phone: string | null
    timezone: string | null
    default_language: string | null
    consultation_fee: number | null
    office_address: string | null
  } | null

  const firm: FirmProfile = {
    name: row?.name ?? "",
    contactEmail: row?.contact_email ?? null,
    phone: row?.phone ?? null,
    timezone: row?.timezone ?? null,
    language: row?.default_language ?? null,
    consultationFee: row?.consultation_fee ?? null,
    officeAddress: row?.office_address ?? null,
  }
  const canManage = me.permissions?.includes("settings.manage") ?? false

  return <GeneralForm firm={firm} canManage={canManage} />
}
