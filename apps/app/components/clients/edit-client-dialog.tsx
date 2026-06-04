"use client"

import * as React from "react"

import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { EditDialogShell } from "@/components/edit-dialog-shell"
import { Field } from "@/components/form-field"
import { CLIENT_STATUS_OPTIONS, SelectField } from "@/components/select-field"
import { CASE_TYPES, STAFF } from "@/data"
import { useStore } from "@/data/store"
import type { CaseType, Client, ClientStatus } from "@/data/types"

const LAS = STAFF.filter((u) => u.role === "legal_assistant" || u.role === "la_lead").map((u) => ({
  value: u.id,
  label: u.name,
}))
const CASE_TYPE_OPTIONS = CASE_TYPES.map((t) => ({ value: t, label: t }))
const PAYMENT_STATUS_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid in full" },
  { value: "payment_arrangement", label: "Payment arrangement" },
]

export function EditClientDialog({
  client,
  trigger,
  open,
  onOpenChange,
}: {
  client: Client
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { updateClient } = useStore()
  const [caseType, setCaseType] = React.useState<string>(client.caseType)
  const [status, setStatus] = React.useState<string>(client.status)
  const [laId, setLaId] = React.useState<string>(client.laId)
  const [paymentStatus, setPaymentStatus] = React.useState<string>(client.paymentStatus)

  function onSubmit(fd: FormData) {
    const total = Number(fd.get("totalFees")) || client.totalFees
    const paid = Number(fd.get("paid")) || 0
    updateClient(
      client.id,
      {
        name: String(fd.get("name") ?? "").trim() || client.name,
        caseType: caseType as CaseType,
        status: status as ClientStatus,
        laId,
        paymentStatus: paymentStatus as Client["paymentStatus"],
        totalFees: total,
        paid,
        balance: Math.max(0, total - paid),
      },
      "Edited client details",
    )
    toast.success("Client updated", { description: client.name })
  }

  return (
    <EditDialogShell
      title="Edit client"
      description={client.name}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={client.name} />
      </Field>
      <SelectField label="Case type" value={caseType} onChange={setCaseType} options={CASE_TYPE_OPTIONS} />
      <SelectField label="Status" value={status} onChange={setStatus} options={CLIENT_STATUS_OPTIONS} />
      <SelectField label="Legal assistant" value={laId} onChange={setLaId} options={LAS} />
      <SelectField
        label="Payment status"
        value={paymentStatus}
        onChange={setPaymentStatus}
        options={PAYMENT_STATUS_OPTIONS}
      />
      <Field label="Total legal fees">
        <Input name="totalFees" type="number" min={0} step={100} defaultValue={client.totalFees} />
      </Field>
      <Field label="Amount paid">
        <Input name="paid" type="number" min={0} step={100} defaultValue={client.paid} />
      </Field>
    </EditDialogShell>
  )
}
