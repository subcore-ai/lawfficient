import { ConsultationTypesEditor } from "@/components/settings/consultation-types-editor"
import { mapConsultationTypeRow } from "@/lib/consultations/consultation-types"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Settings · Consultation types" }

export default async function SettingsConsultationTypesPage() {
  const me = await getCurrentUser()
  const supabase = await createClient()
  const canManage = me?.permissions?.includes("settings.manage") ?? false

  // RLS scopes to the firm; include inactive rows so the editor can show + reactivate them.
  const { data, error } = await supabase
    .from("consultation_types")
    .select("*")
    .order("position")
    .order("created_at")
  if (error) throw error

  const types = (data ?? []).map(mapConsultationTypeRow)
  return <ConsultationTypesEditor types={types} canManage={canManage} />
}
