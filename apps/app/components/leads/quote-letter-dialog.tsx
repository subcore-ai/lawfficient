"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import { Field } from "@/components/form-field"
import { CASE_TYPES } from "@/data"
import type { Lead } from "@/data/types"

const ATTACHMENTS = ["Quote letter", "Process timeline", "Battery chart", "Engagement agreement"]

export function QuoteLetterDialog({ lead }: { lead: Lead }) {
  const [open, setOpen] = React.useState(false)
  const [caseType, setCaseType] = React.useState<string>(lead.caseType ?? "VAWA (AOS)")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    toast.success("Quote letter sent", { description: `Sent to ${lead.email}` })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <FileText className="size-4" /> Send quote letter
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Send quote letter</DialogTitle>
            <DialogDescription>
              Compose the quote letter for {lead.firstName} {lead.lastName}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Case type">
                <Select
                  value={caseType}
                  onValueChange={(v) => setCaseType(v ?? "VAWA (AOS)")}
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
              <Field label="To">
                <Input type="email" defaultValue={lead.email} />
              </Field>
            </div>

            <Field label="Attachments">
              <div className="grid grid-cols-2 gap-2">
                {ATTACHMENTS.map((a, i) => (
                  <div key={a} className="flex items-center gap-2">
                    <Checkbox id={`att-${i}`} defaultChecked={i < 2} />
                    <Label htmlFor={`att-${i}`} className="text-sm font-normal">
                      {a}
                    </Label>
                  </div>
                ))}
              </div>
            </Field>

            <Field label="Message">
              <Textarea
                rows={3}
                defaultValue={`Hello ${lead.firstName}, thank you for your consultation. Please find your quote and process timeline attached.`}
              />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Send</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
