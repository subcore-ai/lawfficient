"use client"

import * as React from "react"

import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { Field } from "@/components/form-field"
import { CASE_TYPES } from "@/data"
import type { AssigneeOption, LeadView } from "@/lib/leads/queries"
import { LEAD_SOURCES } from "@/lib/leads/validation"

const NONE = "none"

// Shared field set for the new/edit lead dialogs. Text inputs submit natively via FormData;
// Base UI Selects aren't form controls, so each mirrors its value into a hidden input the
// server action reads. The NONE sentinel maps to "" (cleared) so buildLeadData drops it.
export function LeadFormFields({ lead, assignees }: { lead?: LeadView; assignees: AssigneeOption[] }) {
  const [source, setSource] = React.useState(lead?.source ?? "Website")
  const [assignee, setAssignee] = React.useState(lead?.assignedToId ?? NONE)
  const [caseType, setCaseType] = React.useState<string>(lead?.data.caseType ?? NONE)
  const [hierarchy, setHierarchy] = React.useState<string>(lead?.data.hierarchy ?? NONE)
  const [qualification, setQualification] = React.useState<string>(lead?.data.qualification ?? NONE)

  const sourceItems = LEAD_SOURCES.map((s) => ({ value: s, label: s }))
  const assigneeItems = [{ value: NONE, label: "Unassigned" }, ...assignees.map((a) => ({ value: a.id, label: a.name }))]
  const caseTypeItems = [{ value: NONE, label: "Not set" }, ...CASE_TYPES.map((t) => ({ value: t, label: t }))]
  const hierarchyItems = [
    { value: NONE, label: "Not set" },
    { value: "HRC", label: "HRC" },
    { value: "NHRC", label: "NHRC" },
  ]
  const qualificationItems = [
    { value: NONE, label: "Not set" },
    { value: "pending", label: "Pending" },
    { value: "qualified", label: "Qualified" },
    { value: "not_qualified", label: "Not qualified" },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="First name">
        <Input name="firstName" required defaultValue={lead?.firstName} placeholder="Maria" />
      </Field>
      <Field label="Last name">
        <Input name="lastName" required defaultValue={lead?.lastName} placeholder="Gonzalez" />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={lead?.phone} placeholder="(305) 555-0142" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={lead?.email} placeholder="maria@email.com" />
      </Field>

      <Field label="Source">
        <Select value={source} onValueChange={(v) => setSource(v ?? "Website")} items={sourceItems}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sourceItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="source" value={source} />
      </Field>
      <Field label="Assign to">
        <Select value={assignee} onValueChange={(v) => setAssignee(v ?? NONE)} items={assigneeItems}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {assigneeItems.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="assignedToId" value={assignee === NONE ? "" : assignee} />
      </Field>

      <Field label="Case type">
        <Select value={caseType} onValueChange={(v) => setCaseType(v ?? NONE)} items={caseTypeItems}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {caseTypeItems.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="caseType" value={caseType === NONE ? "" : caseType} />
      </Field>
      <Field label="Case hierarchy">
        <Select value={hierarchy} onValueChange={(v) => setHierarchy(v ?? NONE)} items={hierarchyItems}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {hierarchyItems.map((h) => (
              <SelectItem key={h.value} value={h.value}>
                {h.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="hierarchy" value={hierarchy === NONE ? "" : hierarchy} />
      </Field>

      <Field label="Qualification">
        <Select value={qualification} onValueChange={(v) => setQualification(v ?? NONE)} items={qualificationItems}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {qualificationItems.map((q) => (
              <SelectItem key={q.value} value={q.value}>
                {q.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="qualification" value={qualification === NONE ? "" : qualification} />
      </Field>
      <Field label="Preferred language">
        <Input name="preferredLanguage" defaultValue={lead?.data.preferredLanguage} placeholder="Spanish" />
      </Field>

      <Field label="Country of origin">
        <Input name="countryOfOrigin" defaultValue={lead?.data.countryOfOrigin} placeholder="Mexico" />
      </Field>
      <Field label="City">
        <Input name="city" defaultValue={lead?.data.city} placeholder="Miami" />
      </Field>
      <Field label="State">
        <Input name="state" defaultValue={lead?.data.state} placeholder="FL" />
      </Field>
      <Field label="ZIP">
        <Input name="zip" defaultValue={lead?.data.zip} placeholder="33101" />
      </Field>
      <Field label="Gender">
        <Input name="gender" defaultValue={lead?.data.gender} placeholder="—" />
      </Field>
      <Field label="Date of birth">
        <Input name="dob" type="date" defaultValue={lead?.data.dob} />
      </Field>

      <Field label="Referral source" className="sm:col-span-2">
        <Input name="referralSource" defaultValue={lead?.data.referralSource} placeholder="Who referred them?" />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Input name="notes" defaultValue={lead?.notes ?? undefined} placeholder="Anything useful for the team" />
      </Field>
    </div>
  )
}
