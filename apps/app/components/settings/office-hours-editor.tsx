"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import { setAttorneyAvailability, setSchedulable } from "@/app/(app)/settings/scheduling/actions"
import { WEEKDAYS, type AvailabilityWindow } from "@/lib/availability/queries"

type Attorney = { id: string; name: string; email: string; windows: AvailabilityWindow[] }
type Draft = { weekday: number; startTime: string; endTime: string }

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
        inside these hours — the booking calendar uses them to offer available times.
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
  const [draft, setDraft] = React.useState<Draft[]>(() =>
    attorney.windows.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime }))
  )
  const [dirty, setDirty] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function addWindow(weekday: number) {
    setDraft((d) => [...d, { weekday, startTime: "09:00", endTime: "17:00" }])
    setDirty(true)
  }
  function updateWindow(index: number, patch: Partial<Draft>) {
    setDraft((d) => d.map((w, i) => (i === index ? { ...w, ...patch } : w)))
    setDirty(true)
  }
  function removeWindow(index: number) {
    setDraft((d) => d.filter((_, i) => i !== index))
    setDirty(true)
  }

  function save() {
    startTransition(async () => {
      const res = await setAttorneyAvailability(attorney.id, draft)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Office hours saved")
      setDirty(false)
    })
  }
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
            <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
              Remove
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {WEEKDAYS.map((day) => {
          const entries = draft.map((w, i) => ({ w, i })).filter((e) => e.w.weekday === day.value)
          return (
            <div
              key={day.value}
              className="border-border flex items-start gap-4 border-b py-2.5 last:border-b-0"
            >
              <div className="text-muted-foreground w-24 shrink-0 pt-2 text-sm">{day.label}</div>
              <div className="flex flex-1 flex-col gap-2">
                {entries.length === 0 ? (
                  <span className="text-muted-foreground pt-2 text-sm">Closed</span>
                ) : (
                  entries.map(({ w, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={w.startTime}
                        onChange={(e) => updateWindow(i, { startTime: e.target.value })}
                        disabled={!canManage}
                        className="w-32"
                        aria-label={`${day.label} start time`}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={w.endTime}
                        onChange={(e) => updateWindow(i, { endTime: e.target.value })}
                        disabled={!canManage}
                        className="w-32"
                        aria-label={`${day.label} end time`}
                      />
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWindow(i)}
                          aria-label={`Remove ${day.label} hours`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => addWindow(day.value)}
                  >
                    <Plus className="size-4" /> Add hours
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </CardContent>
      {canManage ? (
        <CardFooter>
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save office hours"}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}
