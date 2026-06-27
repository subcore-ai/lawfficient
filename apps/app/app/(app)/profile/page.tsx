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

// Only schedulable users (an admin marks who takes consultations) get the office-hours editor. Returns
// null otherwise so the section is hidden entirely. Self-read is allowed by RLS (0041).
async function loadMyOfficeHours(): Promise<{ windows: AvailabilityWindow[] } | null> {
  if (!isSupabaseConfigured()) return null
  const me = await getCurrentUser()
  if (!me) return null

  const supabase = await createClient()
  const { data: prof } = await supabase
    .from("profiles")
    .select("schedulable")
    .eq("id", me.id)
    .maybeSingle()
  if (!prof?.schedulable) return null

  const { data: avail, error } = await supabase
    .from("attorney_availability")
    .select("*")
    .eq("attorney_id", me.id)
  if (error) throw error

  return { windows: (avail ?? []).map(mapAvailabilityRow) }
}

export default async function ProfilePage() {
  const [view, officeHours] = await Promise.all([load(), loadMyOfficeHours()])
  return (
    <>
      <PageHeader title="My profile" description="Manage your display name and password." />
      <div className="flex max-w-5xl flex-col gap-6">
        <ProfileSettings {...view} />
        {officeHours ? (
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
        ) : null}
      </div>
    </>
  )
}
