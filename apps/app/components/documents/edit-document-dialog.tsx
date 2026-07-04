"use client"

import * as React from "react"

import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { EditDialogShell } from "@/components/edit-dialog-shell"
import { Field } from "@/components/form-field"
import {
  CASE_TYPE_OPTIONS,
  DOC_CATEGORY_OPTIONS,
  DOC_STATUS_OPTIONS,
  DOC_TYPE_OPTIONS,
  SelectField,
} from "@/components/select-field"
import { useStore } from "@/data/store"
import type { CaseType, DocItem } from "@/data/types"

export function EditDocumentDialog({
  document,
  trigger,
  open,
  onOpenChange,
}: {
  document: DocItem
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { updateDocument } = useStore()
  const [category, setCategory] = React.useState<string>(document.category)
  const [docType, setDocType] = React.useState<string>(document.docType)
  const [caseType, setCaseType] = React.useState<string>(document.caseType)
  const [status, setStatus] = React.useState<string>(document.status)

  function onSubmit(fd: FormData) {
    updateDocument(
      document.id,
      {
        name: String(fd.get("name") ?? "").trim() || document.name,
        clientName: String(fd.get("clientName") ?? "").trim() || document.clientName,
        category: category as DocItem["category"],
        docType: docType as DocItem["docType"],
        caseType: caseType as CaseType,
        status: status as DocItem["status"],
      },
      "Edited document",
    )
    toast.success("Document updated", { description: document.name })
  }

  return (
    <EditDialogShell
      title="Edit document"
      description={document.name}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <Field label="Document name" className="sm:col-span-2">
        <Input name="name" defaultValue={document.name} />
      </Field>
      <Field label="Client" className="sm:col-span-2">
        <Input name="clientName" defaultValue={document.clientName} />
      </Field>
      <SelectField label="Category" value={category} onChange={setCategory} options={DOC_CATEGORY_OPTIONS} />
      <SelectField label="Document type" value={docType} onChange={setDocType} options={DOC_TYPE_OPTIONS} />
      <SelectField label="Case type" value={caseType} onChange={setCaseType} options={CASE_TYPE_OPTIONS} />
      <SelectField label="Status" value={status} onChange={setStatus} options={DOC_STATUS_OPTIONS} />
    </EditDialogShell>
  )
}
