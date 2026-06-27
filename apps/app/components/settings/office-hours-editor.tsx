"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import { setAttorneyAvailability, setSchedulable } from "@/app/(app)/settings/scheduling/actions"
import { TimeOffManager } from "@/components/availability/time-off-manager"
import { WeeklyHoursEditor } from "@/components/availability/weekly-hours-editor"
import { type TimeOff } from "@/lib/availability/exceptions"
import { type AvailabilityWindow } from "@/lib/availability/queries"

type Attorney = { id: string; name: string; email: string; windows: AvailabilityWindow[]; timeOff: TimeOff[] }

export function OfficeHoursEditor({
  attorneys,
  addableStaff,
  canManage,
}: {
  attorneys: Attorney[]
  addableStaff: { id: string; name: string }[]
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Set each attorney&apos;s weekly office hours. Consultations can only be booked into free slots
        inside these hours — the booking calendar uses them to offer available times. Attorneys can also
        edit their own hours from their profile.
      </p>

      {canManage && addableStaff.length > 0 ? <AddAttorney staff={addableStaff} /> : null}

      {attorneys.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          No one is set up to take consultations yet.
          {canManage ? " Add a team member above to get started." : ""}
        </p>
      ) : (
        attorneys.map((a) => <AttorneyCard key={a.id} attorney={a} canManage={canManage} />)
      )}
    </div>
  )
}

function AddAttorney({ staff }: { staff: { id: string; name: string }[] }) {
  const [value, setValue] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const items = staff.map((s) => ({ value: s.id, label: s.name }))

  function add() {
    if (!value) return
    startTransition(async () => {
      const res = await setSchedulable(value, true)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Added")
      setValue(null)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add an attorney</CardTitle>
        <CardDescription>Pick a team member who takes consultations.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Select value={value} onValueChange={(v) => setValue(v)} items={items}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Choose a team member" />
          </SelectTrigger>
          <SelectContent>
            {items.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={pending || !value}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </CardContent>
    </Card>
  )
}

function AttorneyCard({ attorney, canManage }: { attorney: Attorney; canManage: boolean }) {
  const [pending, startTransition] = React.useTransition()
  const [saving, setSaving] = React.useState(false)

  function remove() {
    startTransition(async () => {
      const res = await setSchedulable(attorney.id, false)
      if ("error" in res) toast.error(res.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{attorney.name}</CardTitle>
        <CardDescription>{attorney.email}</CardDescription>
        {canManage ? (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={remove} disabled={pending || saving}>
              Remove
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <WeeklyHoursEditor
          windows={attorney.windows}
          onSave={(w) => setAttorneyAvailability(attorney.id, w)}
          canEdit={canManage}
          disabled={pending}
          onBusyChange={setSaving}
        />
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Time off</p>
          <TimeOffManager attorneyId={attorney.id} entries={attorney.timeOff} canEdit={canManage} />
        </div>
      </CardContent>
    </Card>
  )
}
