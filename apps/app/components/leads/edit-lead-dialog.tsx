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
import { toast } from "@workspace/ui/components/sonner"

import { EditDialogShell } from "@/components/edit-dialog-shell"
import { Field } from "@/components/form-field"
import { CASE_TYPES, STAFF } from "@/data"
import { useStore } from "@/data/store"
import type { CaseHierarchy, CaseType, Lead, LeadSource } from "@/data/types"

const SOURCES: LeadSource[] = ["WhatsApp", "Facebook", "Instagram", "Call Rails", "Website", "Referral"]
const SALES = STAFF.filter((u) => u.role === "sales")

export function EditLeadDialog({
  lead,
  trigger,
  open,
  onOpenChange,
}: {
  lead: Lead
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { updateLead } = useStore()
  const [source, setSource] = React.useState<string>(lead.source)
  const [caseType, setCaseType] = React.useState<string>(lead.caseType ?? "none")
  const [hierarchy, setHierarchy] = React.useState<string>(lead.hierarchy ?? "none")
  const [assignee, setAssignee] = React.useState<string>(lead.assignedToId)

  function onSubmit(fd: FormData) {
    const get = (k: string) => String(fd.get(k) ?? "").trim()
    updateLead(
      lead.id,
      {
        firstName: get("firstName") || lead.firstName,
        lastName: get("lastName") || lead.lastName,
        phone: get("phone"),
        email: get("email") || lead.email,
        city: get("city"),
        state: get("state"),
        countryOfOrigin: get("countryOfOrigin"),
        preferredLanguage: get("preferredLanguage") || lead.preferredLanguage,
        source: source as LeadSource,
        caseType: caseType === "none" ? undefined : (caseType as CaseType),
        hierarchy: hierarchy === "none" ? undefined : (hierarchy as CaseHierarchy),
        assignedToId: assignee,
      },
      "Edited lead details",
    )
    toast.success("Lead updated", { description: `${lead.firstName} ${lead.lastName}` })
  }

  return (
    <EditDialogShell
      title="Edit lead"
      description={`${lead.firstName} ${lead.lastName}`}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <Field label="First name">
        <Input name="firstName" defaultValue={lead.firstName} />
      </Field>
      <Field label="Last name">
        <Input name="lastName" defaultValue={lead.lastName} />
      </Field>
      <Field label="Phone">
        <Input name="phone" defaultValue={lead.phone} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={lead.email} />
      </Field>
      <Field label="Source">
        <Select value={source} onValueChange={(v) => setSource(v ?? lead.source)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Assigned to">
        <Select value={assignee} onValueChange={(v) => setAssignee(v ?? lead.assignedToId)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SALES.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Case type">
        <Select value={caseType} onValueChange={(v) => setCaseType(v ?? "none")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {CASE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Case hierarchy">
        <Select value={hierarchy} onValueChange={(v) => setHierarchy(v ?? "none")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            <SelectItem value="HRC">HRC</SelectItem>
            <SelectItem value="NHRC">NHRC</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Preferred language">
        <Input name="preferredLanguage" defaultValue={lead.preferredLanguage} />
      </Field>
      <Field label="Country of origin">
        <Input name="countryOfOrigin" defaultValue={lead.countryOfOrigin} />
      </Field>
      <Field label="City">
        <Input name="city" defaultValue={lead.city} />
      </Field>
      <Field label="State">
        <Input name="state" defaultValue={lead.state} />
      </Field>
    </EditDialogShell>
  )
}
