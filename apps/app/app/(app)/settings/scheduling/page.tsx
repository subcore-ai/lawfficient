import { redirect } from "next/navigation"

import { OfficeHoursEditor } from "@/components/settings/office-hours-editor"
import { mapExceptionRow } from "@/lib/availability/exceptions"
import { mapAvailabilityRow } from "@/lib/availability/queries"
import { currentDateInZone } from "@/lib/consultations/time"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Settings · Office hours" }

export default async function SettingsSchedulingPage() {
  const me = await getCurrentUser()
  const canManage = me?.permissions?.includes("settings.manage") ?? false
  // attorney_availability is read-gated by RLS (consultations.view / settings.manage). A user with
  // neither would load zero rows and see every attorney as "Closed" — misleading — so don't show them
  // the page at all (booking staff read availability through the calendar, not here).
  const canView = canManage || (me?.permissions?.includes("consultations.view") ?? false)
  if (!canView) redirect("/settings")

  const supabase = await createClient()

  // RLS scopes all to the firm. Pull all staff (to list schedulable ones + offer the rest), every
  // availability row, and upcoming time off, then fan them out per attorney.
  // Time-off cutoff in the FIRM's zone, so a UTC rollover can't drop a still-current entry.
  const { data: firm } = await supabase.from("firms").select("timezone").maybeSingle()
  const today = currentDateInZone(firm?.timezone || "America/New_York")
  const [staffRes, availRes, offRes] = await Promise.all([
    supabase.from("profiles").select("id, name, email, schedulable, status").order("name"),
    supabase.from("attorney_availability").select("*").order("weekday").order("start_time"),
    supabase.from("availability_exceptions").select("*").gte("end_date", today).order("start_date"),
  ])
  // Surface a load failure instead of silently rendering an empty editor (which a save could persist).
  if (staffRes.error) throw staffRes.error
  if (availRes.error) throw availRes.error
  if (offRes.error) throw offRes.error
  const staff = staffRes.data
  const avail = availRes.data

  const windows = (avail ?? []).map(mapAvailabilityRow)
  const timeOff = (offRes.data ?? []).map(mapExceptionRow)
  const attorneys = (staff ?? [])
    .filter((s) => s.schedulable)
    .map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      windows: windows.filter((w) => w.attorneyId === s.id),
      timeOff: timeOff.filter((t) => t.attorneyId === s.id),
    }))
  const addableStaff = (staff ?? [])
    .filter((s) => !s.schedulable && s.status === "active")
    .map((s) => ({ id: s.id, name: s.name }))

  return <OfficeHoursEditor attorneys={attorneys} addableStaff={addableStaff} canManage={canManage} />
}
