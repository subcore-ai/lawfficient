"use client"

import * as React from "react"

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

export function ExportReportDialog({ title }: { title: string }) {
  const [open, setOpen] = React.useState(false)
  const [format, setFormat] = React.useState("PDF")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    toast.success(`${title} exported`, { description: `Downloaded as ${format}.` })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="mt-1 w-fit" />}>
        Export
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Export {title}</DialogTitle>
            <DialogDescription>Choose a date range and format.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <Field label="From">
              <Input type="date" defaultValue="2026-01-01" />
            </Field>
            <Field label="To">
              <Input type="date" defaultValue="2026-06-30" />
            </Field>
            <Field label="Format" className="sm:col-span-2">
              <Select value={format} onValueChange={(v) => setFormat(v ?? "PDF")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="CSV">CSV (Excel)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Export</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
