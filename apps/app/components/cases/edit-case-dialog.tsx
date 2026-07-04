"use client"

import * as React from "react"

import { toast } from "@workspace/ui/components/sonner"

import { DatePickerField } from "@/components/date-picker"
import { EditDialogShell } from "@/components/edit-dialog-shell"
import { Field } from "@/components/form-field"
import { CASE_STATUS_OPTIONS, CASE_TYPE_OPTIONS, SelectField } from "@/components/select-field"
import { STAFF } from "@/data"
import { useStore } from "@/data/store"
import type { CaseStatus, CaseType, ImmigrationCase } from "@/data/types"

const ATTORNEYS = STAFF.filter((u) => u.role === "attorney").map((u) => ({ value: u.id, label: u.name }))
const LAS = STAFF.filter((u) => u.role === "legal_assistant" || u.role === "la_lead").map((u) => ({
  value: u.id,
  label: u.name,
}))
const DIFFICULTY_OPTIONS = [
  { value: "1", label: "Level 1" },
  { value: "2", label: "Level 2" },
  { value: "3", label: "Level 3" },
]
const HIERARCHY_OPTIONS = [
  { value: "HRC", label: "HRC" },
  { value: "NHRC", label: "NHRC" },
]

export function EditCaseDialog({
  caseItem,
  trigger,
  open,
  onOpenChange,
}: {
  caseItem: ImmigrationCase
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { updateCase } = useStore()
  const [caseType, setCaseType] = React.useState<string>(caseItem.caseType)
  const [hierarchy, setHierarchy] = React.useState<string>(caseItem.hierarchy)
  const [difficulty, setDifficulty] = React.useState<string>(String(caseItem.difficulty))
  const [status, setStatus] = React.useState<string>(caseItem.status)
  const [laId, setLaId] = React.useState<string>(caseItem.laId)
  const [attorneyId, setAttorneyId] = React.useState<string>(caseItem.attorneyId)

  function onSubmit(fd: FormData) {
    updateCase(
      caseItem.id,
      {
        caseType: caseType as CaseType,
        hierarchy: hierarchy as "HRC" | "NHRC",
        difficulty: Number(difficulty) as 1 | 2 | 3,
        status: status as CaseStatus,
        laId,
        attorneyId,
        expectedMailing: String(fd.get("expectedMailing") ?? "") || caseItem.expectedMailing,
      },
      "Edited case details",
    )
    toast.success("Case updated", { description: caseItem.clientName })
  }

  return (
    <EditDialogShell
      title="Edit case"
      description={caseItem.clientName}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <SelectField label="Case type" value={caseType} onChange={setCaseType} options={CASE_TYPE_OPTIONS} />
      <SelectField label="Hierarchy" value={hierarchy} onChange={setHierarchy} options={HIERARCHY_OPTIONS} />
      <SelectField label="Difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} />
      <SelectField label="Status" value={status} onChange={setStatus} options={CASE_STATUS_OPTIONS} />
      <SelectField label="Legal assistant" value={laId} onChange={setLaId} options={LAS} />
      <SelectField label="Attorney" value={attorneyId} onChange={setAttorneyId} options={ATTORNEYS} />
      <Field label="Expected mailing" className="sm:col-span-2">
        <DatePickerField name="expectedMailing" defaultValue={caseItem.expectedMailing} aria-label="Expected mailing" />
      </Field>
    </EditDialogShell>
  )
}
