import { redirect } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { setMyAvailability } from "@/app/(app)/settings/scheduling/actions"
import { TimeOffManager } from "@/components/availability/time-off-manager"
import { WeeklyHoursEditor } from "@/components/availability/weekly-hours-editor"
import { mapExceptionRow, type TimeOff } from "@/lib/availability/exceptions"
import { mapAvailabilityRow, type AvailabilityWindow } from "@/lib/availability/queries"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export const metadata = { title: "My profile · Office hours" }

type Load =
  | { state: "ok"; attorneyId: string; windows: AvailabilityWindow[]; timeOff: TimeOff[] }
  | { state: "off" }
  | { state: "error" }

// Best-effort: "off" = the user isn't schedulable (or Supabase isn't wired) → show a friendly notice;
// "error" = a read failed → show a notice instead of silently hiding real hours. Self-read + stable
// order are RLS-allowed (0041) / DB-ordered.
async function loadMyOfficeHours(): Promise<Load> {
  if (!isSupabaseConfigured()) return { state: "off" }
  const me = await getCurrentUser()
  if (!me) redirect("/login")

  try {
    const supabase = await createClient()
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("schedulable")
      .eq("id", me.id)
      .maybeSingle()
    if (profErr) return { state: "error" }
    if (!prof?.schedulable) return { state: "off" }

    const { data: avail, error } = await supabase
      .from("attorney_availability")
      .select("*")
      .eq("attorney_id", me.id)
      .order("weekday")
      .order("start_time")
    if (error) return { state: "error" }

    // Upcoming time off only (end_date >= today) — past entries are clutter.
    const today = new Date().toISOString().slice(0, 10)
    const { data: off, error: offErr } = await supabase
      .from("availability_exceptions")
      .select("*")
      .eq("attorney_id", me.id)
      .gte("end_date", today)
      .order("start_date")
    if (offErr) return { state: "error" }

    return {
      state: "ok",
      attorneyId: me.id,
      windows: (avail ?? []).map(mapAvailabilityRow),
      timeOff: (off ?? []).map(mapExceptionRow),
    }
  } catch {
    return { state: "error" }
  }
}

export default async function ProfileOfficeHoursPage() {
  const oh = await loadMyOfficeHours()

  if (oh.state === "off") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Office hours</CardTitle>
          <CardDescription>
            You&apos;re not currently set up to take consultations. An admin can enable this from
            Settings → Office hours.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (oh.state === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Office hours</CardTitle>
          <CardDescription>
            Couldn&apos;t load your office hours right now — refresh to try again.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Office hours</CardTitle>
          <CardDescription>
            Your weekly availability for consultations — you can only be booked into free slots inside
            these hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyHoursEditor windows={oh.windows} onSave={setMyAvailability} canEdit />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time off</CardTitle>
          <CardDescription>
            Days you&apos;re unavailable — vacation, holidays, personal time. No consultations can be booked
            on these dates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeOffManager attorneyId={oh.attorneyId} entries={oh.timeOff} canEdit />
        </CardContent>
      </Card>
    </div>
  )
}
