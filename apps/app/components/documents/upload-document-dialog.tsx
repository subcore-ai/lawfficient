"use client"

import * as React from "react"
import { Upload } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
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
import { CASE_TYPES } from "@/data"
import { useStore } from "@/data/store"
import type { CaseType, DocItem } from "@/data/types"

const CATEGORIES: DocItem["category"][] = [
  "Client Upload",
  "USCIS Mail",
  "FBI Prints",
  "Bona Fides",
  "Form",
  "Medical",
]
const DOC_TYPES: DocItem["docType"][] = [
  "Evidence",
  "Approval",
  "RFE",
  "NOID",
  "Interview Notice",
  "Receipt",
]

export function UploadDocumentDialog({
  defaultClientName = "",
  defaultCaseType = "VAWA (AOS)",
  caseId,
  triggerLabel = "Upload document",
  triggerVariant = "outline",
}: {
  defaultClientName?: string
  defaultCaseType?: CaseType
  caseId?: string
  triggerLabel?: string
  triggerVariant?: "default" | "outline"
}) {
  const { addDocument, cases, updateCase } = useStore()
  const [open, setOpen] = React.useState(false)
  const [category, setCategory] = React.useState<DocItem["category"]>("Client Upload")
  const [docType, setDocType] = React.useState<DocItem["docType"]>("Evidence")
  const [caseType, setCaseType] = React.useState<string>(defaultCaseType)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const clientName = String(fd.get("clientName") ?? "").trim() || "Unassigned"
    const name = String(fd.get("name") ?? "").trim() || "Untitled document"

    addDocument({ clientName, name, category, docType, caseType: caseType as CaseType })

    if (caseId) {
      const c = cases.find((x) => x.id === caseId)
      if (c) updateCase(caseId, { checklistComplete: Math.min(100, c.checklistComplete + 8) })
    }

    toast.success("Document uploaded", { description: `${name} filed for ${clientName}.` })
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" />}>
        <Upload className="size-4" /> {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>File a document and link it to the client&apos;s case.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label="Client" className="sm:col-span-2">
              <Input name="clientName" defaultValue={defaultClientName} placeholder="Rosa Delgado" />
            </Field>
            <Field label="Document name" className="sm:col-span-2">
              <Input name="name" required placeholder="Affidavit of Support" />
            </Field>
            <Field label="Category">
              <Select
                value={category}
                onValueChange={(v) => setCategory((v ?? "Client Upload") as DocItem["category"])}
                items={CATEGORIES.map((c) => ({ value: c, label: c }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Document type">
              <Select
                value={docType}
                onValueChange={(v) => setDocType((v ?? "Evidence") as DocItem["docType"])}
                items={DOC_TYPES.map((t) => ({ value: t, label: t }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Case type" className="sm:col-span-2">
              <Select
                value={caseType}
                onValueChange={(v) => setCaseType(v ?? defaultCaseType)}
                items={CASE_TYPES.map((t) => ({ value: t, label: t }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Case type" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Upload</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
