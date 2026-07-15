"use client"

import * as React from "react"
import { Pencil, Plus } from "lucide-react"

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
  setConsultationTypeActive,
} from "@/app/(app)/settings/consultation-types/actions"
import { Field } from "@/components/form-field"
import { DeleteConfirmButton } from "@/components/settings/delete-confirm-button"
import { StatusPill } from "@/components/status-pill"
import type { ConsultationType } from "@/lib/consultations/consultation-types"

const GENERIC_ERROR = "Something went wrong. Please try again."

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
          <Input name="durationMin" type="number" min={5} step={5} required defaultValue={type?.durationMin ?? 30} />
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
      try {
        const res = await createConsultationType(fd)
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success("Type added")
        setOpen(false)
      } catch {
        toast.error(GENERIC_ERROR)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" /> New type
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Remount the form per open so the uncontrolled fields reset to fresh defaults each time. */}
        {open ? (
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
        ) : null}
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
      try {
        const res = await editConsultationType(type.id, fd)
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        toast.success("Saved")
        setOpen(false)
      } catch {
        toast.error(GENERIC_ERROR)
      }
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

function TypeRow({ type, canManage }: { type: ConsultationType; canManage: boolean }) {
  const [pending, startTransition] = React.useTransition()
  function toggleActive() {
    startTransition(async () => {
      try {
        const res = await setConsultationTypeActive(type.id, !type.isActive)
        if ("error" in res) toast.error(res.error)
      } catch {
        toast.error(GENERIC_ERROR)
      }
    })
  }
  return (
    <div className="border-border flex items-center justify-between gap-3 border-b py-2.5 first:pt-0 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm ${type.isActive ? "" : "text-muted-foreground line-through"}`}>
            {type.name}
          </p>
          {!type.isActive ? <StatusPill label="Inactive" tone="warning" /> : null}
        </div>
        <p className="text-muted-foreground text-xs">{summarize(type)}</p>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggleActive} disabled={pending}>
            {type.isActive ? "Deactivate" : "Activate"}
          </Button>
          <EditTypeDialog type={type} />
          <DeleteConfirmButton
            entityLabel={type.name}
            title={`Delete ${type.name}?`}
            description="Past consultations keep their type and price — deleting only removes it from the booking picker. Or deactivate it to hide it while keeping it here."
            successMessage="Deleted"
            action={() => deleteConsultationType(type.id)}
          />
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
          types.map((t) => <TypeRow key={t.id} type={t} canManage={canManage} />)
        )}
      </CardContent>
    </Card>
  )
}
