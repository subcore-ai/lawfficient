"use client"

import * as React from "react"
import { Pencil } from "lucide-react"

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
import { toast } from "@workspace/ui/components/sonner"

import { deleteTaxonomy, editTaxonomy, setTaxonomyActive } from "@/app/(app)/settings/taxonomies/actions"
import { Field } from "@/components/form-field"
import { DeleteConfirmButton } from "@/components/settings/delete-confirm-button"
import { StatusPill } from "@/components/status-pill"
import type { TaxonomyOption } from "@/lib/taxonomies/queries"

// Shared by the static list and the draggable list so a row looks identical either way. Use a TOP border for
// the between-row separators (not bottom): dnd-kit appends a hidden a11y node after the rows, so the last row
// isn't :last-child and a `last:border-b-0` wouldn't apply — leaving a line that doubles the card's border.
export const TAXONOMY_ROW_CLASS =
  "border-border flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0 first:pt-0"

// The inner content of a row: a `handle` slot on the left (the drag grip, or a static placeholder), the
// label + badges + notes, and the manage actions. The caller owns the outer row container.
export function TaxonomyRowContent({
  option,
  canManage,
  handle,
}: {
  option: TaxonomyOption
  canManage: boolean
  handle?: React.ReactNode
}) {
  const [pending, startTransition] = React.useTransition()
  function toggleActive() {
    const activating = !option.isActive
    startTransition(async () => {
      const res = await setTaxonomyActive(option.id, activating)
      if ("error" in res) toast.error(res.error)
      else toast.success(activating ? "Activated" : "Deactivated")
    })
  }
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        {handle}
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
          {!option.isSystem ? (
            <DeleteConfirmButton
              entityLabel={option.label}
              title={`Delete ${option.label}?`}
              description="You can't delete a value that leads are using — deactivate it instead to keep it for reference while hiding it from new leads."
              successMessage="Deleted"
              action={() => deleteTaxonomy(option.id)}
            />
          ) : null}
        </div>
      ) : null}
    </>
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
