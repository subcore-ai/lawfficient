"use client"

import * as React from "react"
import { GripVertical, Plus } from "lucide-react"

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

import { createTaxonomy } from "@/app/(app)/settings/taxonomies/actions"
import { Field } from "@/components/form-field"
import { TAXONOMY_ROW_CLASS, TaxonomyRowContent } from "@/components/settings/taxonomy-row"
import type { TaxonomyCategory, TaxonomyOption } from "@/lib/taxonomies/queries"

// Drag-and-drop reordering pulls in dnd-kit; lazy-load it so that ~weight only ships on this settings page
// (and only for admins, who can reorder). Read-only viewers and every other page never download it.
const SortableTaxonomyList = React.lazy(() =>
  import("@/components/settings/sortable-taxonomy-list").then((m) => ({ default: m.SortableTaxonomyList })),
)

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

// Non-draggable rows — used for read-only viewers and as the Suspense fallback while dnd-kit loads (so the
// list is on screen immediately; admins get a dimmed grip placeholder that the real handle replaces).
function StaticTaxonomyList({ options, canManage }: { options: TaxonomyOption[]; canManage: boolean }) {
  return (
    <>
      {options.map((o) => (
        <div key={o.id} className={TAXONOMY_ROW_CLASS}>
          <TaxonomyRowContent
            option={o}
            canManage={canManage}
            handle={
              canManage ? (
                <span className="text-muted-foreground/40 p-1" aria-hidden>
                  <GripVertical className="size-4" />
                </span>
              ) : null
            }
          />
        </div>
      ))}
    </>
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
        ) : canManage ? (
          <React.Suspense fallback={<StaticTaxonomyList options={options} canManage />}>
            <SortableTaxonomyList category={category} options={options} />
          </React.Suspense>
        ) : (
          <StaticTaxonomyList options={options} canManage={false} />
        )}
      </CardContent>
    </Card>
  )
}
