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
  createConsultationType,
  deleteConsultationType,
  editConsultationType,
  reorderConsultationType,
  setConsultationTypeActive,
} from "@/app/(app)/settings/consultation-types/actions"
import { Field } from "@/components/form-field"
import { StatusPill } from "@/components/status-pill"
import type { ConsultationType } from "@/lib/consultations/consultation-types"

function summarize(type: ConsultationType): string {
  return `${type.durationMin} min · ${type.price > 0 ? `$${type.price}` : "Free"}`
}

function TypeFields({ type }: { type?: ConsultationType }) {
  return (
    <div className="flex flex-col gap-4 py-5">
      <Field label="Name">
        <Input name="name" required autoComplete="off" defaultValue={type?.name} placeholder="e.g. Initial consultation" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Duration (minutes)">
          <Input
            name="durationMin"
            type="number"
            min={5}
            step={5}
            required
            defaultValue={type?.durationMin ?? 30}
          />
        </Field>
        <Field label="Price (0 = free)">
          <Input name="price" type="number" min={0} step="0.01" defaultValue={type?.price ?? 0} />
        </Field>
      </div>
    </div>
  )
}

function CreateTypeDialog() {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createConsultationType(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Type added")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" /> New type
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New consultation type</DialogTitle>
            <DialogDescription>Booking offers calendar slots of the type&apos;s length.</DialogDescription>
          </DialogHeader>
          <TypeFields />
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

function EditTypeDialog({ type }: { type: ConsultationType }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await editConsultationType(type.id, fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Saved")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Edit ${type.name}`} />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Remount the form per open so defaults re-read from the latest props. */}
        {open ? (
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Edit type</DialogTitle>
              <DialogDescription>Changes apply to new bookings; past consultations keep their values.</DialogDescription>
            </DialogHeader>
            <TypeFields type={type} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DeleteTypeButton({ type }: { type: ConsultationType }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  function onDelete() {
    startTransition(async () => {
      const res = await deleteConsultationType(type.id)
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
      <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Delete ${type.name}`} />}>
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {type.name}?</DialogTitle>
          <DialogDescription>
            Past consultations keep their type and price — deleting only removes it from the booking
            picker. Or deactivate it to hide it while keeping it here.
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

function TypeRow({
  type,
  canManage,
  isFirst,
  isLast,
}: {
  type: ConsultationType
  canManage: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  function reorder(direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderConsultationType(type.id, direction)
      if ("error" in res) toast.error(res.error)
    })
  }
  function toggleActive() {
    startTransition(async () => {
      const res = await setConsultationTypeActive(type.id, !type.isActive)
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
            <p className={`truncate text-sm ${type.isActive ? "" : "text-muted-foreground line-through"}`}>
              {type.name}
            </p>
            {!type.isActive ? <StatusPill label="Inactive" tone="warning" /> : null}
          </div>
          <p className="text-muted-foreground text-xs">{summarize(type)}</p>
        </div>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggleActive} disabled={pending}>
            {type.isActive ? "Deactivate" : "Activate"}
          </Button>
          <EditTypeDialog type={type} />
          <DeleteTypeButton type={type} />
        </div>
      ) : null}
    </div>
  )
}

export function ConsultationTypesEditor({
  types,
  canManage,
}: {
  types: ConsultationType[]
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultation types</CardTitle>
        <CardDescription>
          The kinds of consultation your firm offers, each with a default length and price. Booking picks
          a type and the calendar offers slots that long.
        </CardDescription>
        {canManage ? (
          <CardAction>
            <CreateTypeDialog />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col">
        {types.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No consultation types yet.
          </p>
        ) : (
          types.map((t, i) => (
            <TypeRow
              key={t.id}
              type={t}
              canManage={canManage}
              isFirst={i === 0}
              isLast={i === types.length - 1}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
