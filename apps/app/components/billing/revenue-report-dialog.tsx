"use client"

import * as React from "react"
import { Download } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/sonner"

import { DatePickerField } from "@/components/date-picker"
import { Field } from "@/components/form-field"

export function RevenueReportDialog() {
  const [open, setOpen] = React.useState(false)
  const [format, setFormat] = React.useState("CSV")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    toast.success("Revenue report generated", { description: `Exported as ${format}.` })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="size-4" /> Revenue report
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Revenue report</DialogTitle>
            <DialogDescription>
              Generate a revenue report classified by payment type and case type.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label="From">
              <DatePickerField name="from" defaultValue="2026-06-01" aria-label="From" />
            </Field>
            <Field label="To">
              <DatePickerField name="to" defaultValue="2026-06-30" aria-label="To" />
            </Field>
            <Field label="Format" className="sm:col-span-2">
              <Select
                value={format}
                onValueChange={(v) => setFormat(v ?? "CSV")}
                items={[
                  { value: "CSV", label: "CSV (Excel)" },
                  { value: "PDF", label: "PDF" },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSV">CSV (Excel)</SelectItem>
                  <SelectItem value="PDF">PDF</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Generate</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
