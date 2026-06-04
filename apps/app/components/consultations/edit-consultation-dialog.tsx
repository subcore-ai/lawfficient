"use client"

import * as React from "react"

import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { EditDialogShell } from "@/components/edit-dialog-shell"
import { Field } from "@/components/form-field"
import { CONSULT_STATUS_OPTIONS, SelectField } from "@/components/select-field"
import { CASE_TYPES, STAFF } from "@/data"
import { useStore } from "@/data/store"
import type { CaseType, Consultation, ConsultationStatus } from "@/data/types"

const ATTORNEYS = STAFF.filter((u) => u.role === "attorney").map((u) => ({ value: u.id, label: u.name }))
const ZONE_OPTIONS = ["PT", "MT", "CT", "ET", "HT"].map((v) => ({ value: v, label: v }))
const CASE_TYPE_OPTIONS = [{ value: "none", label: "Not set" }, ...CASE_TYPES.map((t) => ({ value: t, label: t }))]

export function EditConsultationDialog({
  consultation,
  trigger,
  open,
  onOpenChange,
}: {
  consultation: Consultation
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { updateConsultation } = useStore()
  const [attorneyId, setAttorneyId] = React.useState(consultation.attorneyId)
  const [caseType, setCaseType] = React.useState<string>(consultation.caseType ?? "none")
  const [timeZone, setTimeZone] = React.useState(consultation.timeZone)
  const [status, setStatus] = React.useState<string>(consultation.status)

  function onSubmit(fd: FormData) {
    const amount = Number(fd.get("amount")) || undefined
    updateConsultation(
      consultation.id,
      {
        leadName: String(fd.get("leadName") ?? "").trim() || consultation.leadName,
        type: String(fd.get("type") ?? "").trim() || consultation.type,
        attorneyId,
        caseType: caseType === "none" ? undefined : (caseType as CaseType),
        timeZone,
        status: status as ConsultationStatus,
        amount,
        paid: status === "paid",
      },
      "Edited consultation",
    )
    toast.success("Consultation updated", { description: consultation.leadName })
  }

  return (
    <EditDialogShell
      title="Edit consultation"
      description={consultation.leadName}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <Field label="Client">
        <Input name="leadName" defaultValue={consultation.leadName} />
      </Field>
      <Field label="Type">
        <Input name="type" defaultValue={consultation.type} />
      </Field>
      <SelectField label="Attorney" value={attorneyId} onChange={setAttorneyId} options={ATTORNEYS} />
      <SelectField label="Status" value={status} onChange={setStatus} options={CONSULT_STATUS_OPTIONS} />
      <SelectField label="Case type" value={caseType} onChange={setCaseType} options={CASE_TYPE_OPTIONS} />
      <SelectField label="Time zone" value={timeZone} onChange={setTimeZone} options={ZONE_OPTIONS} />
      <Field label="Amount (USD)" className="sm:col-span-2">
        <Input name="amount" type="number" min={0} step={25} defaultValue={consultation.amount ?? ""} />
      </Field>
    </EditDialogShell>
  )
}
