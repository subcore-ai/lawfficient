import { redirect } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { setMyAvailability } from "@/app/(app)/settings/scheduling/actions"
import { WeeklyHoursEditor } from "@/components/availability/weekly-hours-editor"
import { PageHeader } from "@/components/page-header"
import { ProfileSettings } from "@/components/profile-form"
import { mapAvailabilityRow, type AvailabilityWindow } from "@/lib/availability/queries"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { CURRENT_USER } from "@/data"
import type { Role } from "@/data/types"

export const metadata = { title: "My profile" }

type ProfileView = {
  name: string
  email: string
  role: Role
  pod: string | null
  editable: boolean
  googleConnected: boolean
  avatarUrl: string | null
}

async function load(): Promise<ProfileView> {
  // Phase 0 fallback: with no Supabase wired, show the mock identity read-only
  // (the save actions are server-backed, so they can't complete without it).
  if (!isSupabaseConfigured()) {
    return {
      name: CURRENT_USER.name,
      email: CURRENT_USER.email,
      role: CURRENT_USER.role,
      pod: null,
      editable: false,
      googleConnected: false,
      avatarUrl: null,
    }
  }

  const me = await getCurrentUser()
  if (!me) redirect("/login")

  const supabase = await createClient()

  // A linked Google identity only exists if Google sign-in was enabled and used,
  // so its presence is the signal — no separate "is Google on" flag is needed.
  const { data } = await supabase.auth.getUser()
  const googleConnected = (data?.user?.identities ?? []).some((i) => i.provider === "google")

  let pod: string | null = null
  if (me.podId) {
    const { data } = await supabase.from("pods").select("name").eq("id", me.podId).maybeSingle()
    pod = data?.name ?? null
  }

  return { name: me.name, email: me.email, role: me.role, pod, editable: true, googleConnected, avatarUrl: me.avatarUrl }
}

type OfficeHoursLoad = { windows: AvailabilityWindow[] } | { error: true } | null

// Best-effort: the office-hours card is secondary to the profile, so a failed load must NEVER take the
// whole page (incl. name + password) down. Returns null when the user isn't schedulable (no card),
// { error } when a read fails (the page shows a notice instead of silently hiding real hours, and
// treating a failed read as "not schedulable" would do exactly that), or the windows. Self-read +
// stable order are RLS-allowed (0041) / DB-ordered.
async function loadMyOfficeHours(): Promise<OfficeHoursLoad> {
  if (!isSupabaseConfigured()) return null
  const me = await getCurrentUser()
  if (!me) return null

  try {
    const supabase = await createClient()
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("schedulable")
      .eq("id", me.id)
      .maybeSingle()
    if (profErr) return { error: true }
    if (!prof?.schedulable) return null

    const { data: avail, error } = await supabase
      .from("attorney_availability")
      .select("*")
      .eq("attorney_id", me.id)
      .order("weekday")
      .order("start_time")
    if (error) return { error: true }

    return { windows: (avail ?? []).map(mapAvailabilityRow) }
  } catch {
    return { error: true }
  }
}

export default async function ProfilePage() {
  const [view, officeHours] = await Promise.all([load(), loadMyOfficeHours()])
  return (
    <>
      <PageHeader title="My profile" description="Manage your display name and password." />
      <div className="flex max-w-5xl flex-col gap-6">
        <ProfileSettings {...view} />
        {officeHours == null ? null : "error" in officeHours ? (
          <Card>
            <CardHeader>
              <CardTitle>My office hours</CardTitle>
              <CardDescription>
                Couldn&apos;t load your office hours right now — refresh to try again.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>My office hours</CardTitle>
              <CardDescription>
                Your weekly availability for consultations — you can only be booked into free slots
                inside these hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyHoursEditor windows={officeHours.windows} onSave={setMyAvailability} canEdit />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
