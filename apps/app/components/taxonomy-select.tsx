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

import { createTaxonomyInline } from "@/app/(app)/settings/taxonomies/actions"
import { Field } from "@/components/form-field"
import type { TaxonomyCategory } from "@/lib/taxonomies/queries"

const ADD = "__add__"

type Item = { value: string; label: string }

// A firm-taxonomy dropdown with an optional inline "+ new …" (settings.manage only). Selecting the
// sentinel opens a one-input dialog, creates the value, and auto-selects it. The caller owns the
// hidden input that mirrors `value` into the form's FormData (see lead-form-fields).
export function TaxonomySelect({
  category,
  value,
  onValueChange,
  options,
  canManage,
  addLabel,
  noneValue,
  noneLabel = "Not set",
}: {
  category: TaxonomyCategory
  value: string
  onValueChange: (v: string) => void
  options: Item[]
  canManage: boolean
  addLabel: string
  noneValue: string
  noneLabel?: string
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState("")
  const [extra, setExtra] = React.useState<Item[]>([]) // values added inline this session
  const [pending, startTransition] = React.useTransition()

  const items: Item[] = [{ value: noneValue, label: noneLabel }, ...options, ...extra]

  function handleChange(v: string | null) {
    if (v === ADD) {
      setDialogOpen(true)
      return
    }
    onValueChange(v ?? noneValue)
  }

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    startTransition(async () => {
      const res = await createTaxonomyInline(category, label)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setExtra((prev) => [...prev, { value: res.label, label: res.label }])
      onValueChange(res.label)
      setNewLabel("")
      setDialogOpen(false)
      toast.success("Added")
    })
  }

  return (
    <>
      <Select value={value} onValueChange={handleChange} items={items}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((it) => (
            <SelectItem key={it.value} value={it.value}>
              {it.label}
            </SelectItem>
          ))}
          {canManage ? (
            <SelectItem value={ADD} className="text-primary">
              {addLabel}
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>{addLabel.replace(/^\+\s*/, "")}</DialogTitle>
              <DialogDescription>Adds it to your firm&apos;s list and selects it.</DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Field label="Value">
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} required autoFocus autoComplete="off" />
              </Field>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
