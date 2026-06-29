"use client"

import * as React from "react"

import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { DatePickerField } from "@/components/date-picker"
import { EditDialogShell } from "@/components/edit-dialog-shell"
import { Field } from "@/components/form-field"
import { INVOICE_STATUS_OPTIONS, PAYMENT_TYPE_OPTIONS, SelectField } from "@/components/select-field"
import { useStore } from "@/data/store"
import type { Invoice, InvoiceStatus, PaymentType } from "@/data/types"

export function EditInvoiceDialog({
  invoice,
  trigger,
  open,
  onOpenChange,
}: {
  invoice: Invoice
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { updateInvoice } = useStore()
  const [status, setStatus] = React.useState<string>(invoice.status)
  const [type, setType] = React.useState<string>(invoice.type)

  function onSubmit(fd: FormData) {
    const total = Number(fd.get("total")) || invoice.total
    const paid = Number(fd.get("paid")) || 0
    updateInvoice(
      invoice.id,
      {
        status: status as InvoiceStatus,
        type: type as PaymentType,
        total,
        paid,
        remaining: Math.max(0, total - paid),
        dueAt: String(fd.get("dueAt") ?? "") || invoice.dueAt,
      },
      "Edited invoice",
    )
    toast.success("Invoice updated", { description: invoice.number })
  }

  return (
    <EditDialogShell
      title={`Edit ${invoice.number}`}
      description={invoice.clientName}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <SelectField label="Status" value={status} onChange={setStatus} options={INVOICE_STATUS_OPTIONS} />
      <SelectField label="Payment type" value={type} onChange={setType} options={PAYMENT_TYPE_OPTIONS} />
      <Field label="Total (USD)">
        <Input name="total" type="number" min={0} step={50} defaultValue={invoice.total} />
      </Field>
      <Field label="Amount paid (USD)">
        <Input name="paid" type="number" min={0} step={50} defaultValue={invoice.paid} />
      </Field>
      <Field label="Due date" className="sm:col-span-2">
        <DatePickerField name="dueAt" defaultValue={invoice.dueAt} aria-label="Due date" />
      </Field>
    </EditDialogShell>
  )
}
