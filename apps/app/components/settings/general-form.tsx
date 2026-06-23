"use client"

import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import { Field } from "@/components/form-field"
import { FIRM_TIMEZONES } from "@/lib/firm/timezones"
import { updateFirmProfile } from "@/app/(app)/settings/actions"

export type FirmProfile = {
  name: string
  contactEmail: string | null
  phone: string | null
  timezone: string | null
  language: string | null
  consultationFee: number | null
  officeAddress: string | null
}

export function GeneralForm({
  firm,
  canManage,
}: {
  firm: FirmProfile
  canManage: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  // Snapshot the firm at mount. A successful save revalidates this page and re-feeds props, but
  // the fields below are uncontrolled — re-feeding a changed defaultValue would trip Base UI's
  // "changed defaultValue after init" warning (and be ignored anyway, since the DOM already holds
  // the user's edits, which equal what was just saved).
  const initial = React.useRef(firm).current
  // The Select isn't a native form control, so its value is tracked here and set onto the
  // FormData at submit time.
  const [timezone, setTimezone] = React.useState(initial.timezone ?? "")
  const disabled = !canManage || pending

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("timezone", timezone)
    startTransition(async () => {
      const res = await updateFirmProfile(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Firm profile saved", { description: "Changes are live for the team." })
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firm profile</CardTitle>
        <CardDescription>Your firm&apos;s name, contact details, and defaults.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Firm name">
              <Input name="name" defaultValue={initial.name} required maxLength={200} disabled={disabled} />
            </Field>
            <Field label="Contact email">
              <Input
                name="contactEmail"
                type="email"
                defaultValue={initial.contactEmail ?? ""}
                maxLength={254}
                disabled={disabled}
              />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" defaultValue={initial.phone ?? ""} maxLength={40} disabled={disabled} />
            </Field>
            <Field label="Default time zone">
              <Select
                value={timezone}
                onValueChange={(v) => setTimezone(v ?? "")}
                items={FIRM_TIMEZONES.map((t) => ({ value: t.value, label: t.label }))}
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a time zone" />
                </SelectTrigger>
                <SelectContent>
                  {FIRM_TIMEZONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default language">
              <Input name="language" defaultValue={initial.language ?? ""} maxLength={60} disabled={disabled} />
            </Field>
            <Field label="Default consultation fee">
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  $
                </span>
                <Input
                  name="consultationFee"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={initial.consultationFee ?? ""}
                  className="pl-7"
                  disabled={disabled}
                />
              </div>
            </Field>
            <Field label="Office address" className="sm:col-span-2">
              <Input
                name="address"
                defaultValue={initial.officeAddress ?? ""}
                maxLength={300}
                disabled={disabled}
              />
            </Field>
          </div>
          {canManage ? (
            <Button type="submit" className="w-fit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">Only admins can edit the firm profile.</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
