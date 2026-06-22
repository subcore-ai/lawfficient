"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { toast } from "@workspace/ui/components/sonner"

import {
  createTaxonomy,
  deleteTaxonomy,
  editTaxonomy,
  reorderTaxonomy,
  setTaxonomyActive,
} from "@/app/(app)/settings/taxonomies/actions"
import { Field } from "@/components/form-field"
import { StatusPill } from "@/components/status-pill"
import type { TaxonomyCategory, TaxonomyOption } from "@/lib/taxonomies/queries"

function CreateTaxonomyDialog({ category, noun }: { category: TaxonomyCategory; noun: string }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createTaxonomy(category, fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(`${noun} added`)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" /> New
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New {noun.toLowerCase()}</DialogTitle>
            <DialogDescription>Add a {noun.toLowerCase()} for your firm.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Value">
              <Input name="label" required autoComplete="off" placeholder="e.g. Asylum" />
            </Field>
            <Field label="Notes (optional)">
              <Input name="notes" autoComplete="off" placeholder="What it means / when to use it" />
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
  )
}

function EditTaxonomyDialog({ option }: { option: TaxonomyOption }) {
  const [open, setOpen] = React.useState(false)
  const [label, setLabel] = React.useState(option.label)
  const [notes, setNotes] = React.useState(option.notes ?? "")
  const [pending, startTransition] = React.useTransition()

  // Re-sync from server data on open (controlled inputs, no stale values after an edit).
  function handleOpenChange(next: boolean) {
    if (next) {
      setLabel(option.label)
      setNotes(option.notes ?? "")
    }
    setOpen(next)
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await editTaxonomy(option.id, fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Saved")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Edit ${option.label}`} />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit value</DialogTitle>
            <DialogDescription>
              {option.isSystem
                ? "This is a built-in value — its name is fixed, but you can add notes."
                : "Renaming updates every lead currently using this value."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-5">
            <Field label="Value">
              {/* readOnly (not disabled) so a system row's label still submits → notes-only edit. */}
              <Input
                name="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                autoComplete="off"
                readOnly={option.isSystem}
              />
            </Field>
            <Field label="Notes (optional)">
              <Input
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                autoComplete="off"
                placeholder="What it means / when to use it"
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTaxonomyButton({ option }: { option: TaxonomyOption }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  function onDelete() {
    startTransition(async () => {
      const res = await deleteTaxonomy(option.id)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Deleted")
      setOpen(false)
    })
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Delete ${option.label}`} />}>
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {option.label}?</DialogTitle>
          <DialogDescription>
            You can&apos;t delete a value that leads are using — deactivate it instead to keep it for
            reference while hiding it from new leads.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TaxonomyRow({
  option,
  canManage,
  isFirst,
  isLast,
}: {
  option: TaxonomyOption
  canManage: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  function reorder(direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderTaxonomy(option.id, direction)
      if ("error" in res) toast.error(res.error)
    })
  }
  function toggleActive() {
    startTransition(async () => {
      const res = await setTaxonomyActive(option.id, !option.isActive)
      if ("error" in res) toast.error(res.error)
    })
  }
  return (
    <div className="border-border flex items-center justify-between gap-3 border-b py-2.5 first:pt-0 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        {canManage ? (
          <div className="flex flex-col">
            <button
              type="button"
              aria-label="Move up"
              disabled={isFirst || pending}
              onClick={() => reorder("up")}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={isLast || pending}
              onClick={() => reorder("down")}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={`truncate text-sm ${option.isActive ? "" : "text-muted-foreground line-through"}`}>
              {option.label}
            </p>
            {option.isSystem ? <StatusPill label="System" tone="neutral" /> : null}
            {!option.isActive ? <StatusPill label="Inactive" tone="warning" /> : null}
          </div>
          {option.notes ? <p className="text-muted-foreground truncate text-xs">{option.notes}</p> : null}
        </div>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggleActive} disabled={pending}>
            {option.isActive ? "Deactivate" : "Activate"}
          </Button>
          <EditTaxonomyDialog option={option} />
          {!option.isSystem ? <DeleteTaxonomyButton option={option} /> : null}
        </div>
      ) : null}
    </div>
  )
}

export function TaxonomySection({
  category,
  title,
  description,
  noun,
  options,
  canManage,
}: {
  category: TaxonomyCategory
  title: string
  description: string
  noun: string
  options: TaxonomyOption[]
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {canManage ? (
          <CardAction>
            <CreateTaxonomyDialog category={category} noun={noun} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col">
        {options.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No values yet.
          </p>
        ) : (
          options.map((o, i) => (
            <TaxonomyRow
              key={o.id}
              option={o}
              canManage={canManage}
              isFirst={i === 0}
              isLast={i === options.length - 1}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
