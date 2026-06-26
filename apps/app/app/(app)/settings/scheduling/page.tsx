import { OfficeHoursEditor } from "@/components/settings/office-hours-editor"
import { mapAvailabilityRow } from "@/lib/availability/queries"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Settings · Office hours" }

export default async function SettingsSchedulingPage() {
  const me = await getCurrentUser()
  const supabase = await createClient()
  const canManage = me?.permissions?.includes("settings.manage") ?? false

  // RLS scopes both to the firm. Pull all staff (to list schedulable ones + offer the rest) and every
  // availability row, then fan the windows out per attorney.
  const [{ data: staff }, { data: avail }] = await Promise.all([
    supabase.from("profiles").select("id, name, email, schedulable, status").order("name"),
    supabase.from("attorney_availability").select("*"),
  ])

  const windows = (avail ?? []).map(mapAvailabilityRow)
  const attorneys = (staff ?? [])
    .filter((s) => s.schedulable)
    .map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      windows: windows.filter((w) => w.attorneyId === s.id),
    }))
  const addableStaff = (staff ?? [])
    .filter((s) => !s.schedulable && s.status === "active")
    .map((s) => ({ id: s.id, name: s.name }))

  return <OfficeHoursEditor attorneys={attorneys} addableStaff={addableStaff} canManage={canManage} />
}
