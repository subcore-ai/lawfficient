"use client"

import * as React from "react"
import { MoreHorizontal, MoreVertical } from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import {
  deleteConsultation,
  setConsultationOutcome,
  setConsultationStatus,
} from "@/app/(app)/consultations/actions"
import { EditConsultationDialog } from "@/components/consultations/edit-consultation-dialog"
import { Field } from "@/components/form-field"
import type { ActionResult } from "@/lib/actions/result"
import type { ConsultationStatus } from "@/lib/consultations/validation"

function useRun() {
  const [pending, startTransition] = React.useTransition()
  const run = (fn: () => Promise<ActionResult>, okMsg?: string, onOk?: () => void) =>
    startTransition(async () => {
      try {
        const res = await fn()
        if ("error" in res) {
          toast.error(res.error)
          return
        }
        if (okMsg) toast.success(okMsg)
        onOk?.()
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  return { pending, run }
}

// The per-consultation actions menu, shared by the consultations board and the lead detail card.
// `compact` renders an icon-only kebab (dense rows); otherwise a labelled "Actions" button. Reschedule /
// complete / no-show / cancel only apply to a live consult; a terminal one can still record its outcome.
export function ConsultationActions({
  consultationId,
  status,
  outcome,
  compact = false,
  hideEdit = false,
}: {
  consultationId: string
  status: ConsultationStatus
  outcome: string | null
  compact?: boolean
  // The calendar's detail dialog edits fields inline, so it hides this menu's "Edit consultation…" entry.
  hideEdit?: boolean
}) {
  const { pending, run } = useRun()
  const [editOpen, setEditOpen] = React.useState(false)
  const [outcomeOpen, setOutcomeOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const isActive = status === "scheduled" || status === "paid" || status === "rescheduled"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            compact ? (
              <Button variant="ghost" size="icon" className="size-8" disabled={pending} aria-label="Consultation actions" />
            ) : (
              <Button variant="ghost" size="sm" disabled={pending} />
            )
          }
        >
          {compact ? (
            <MoreVertical className="size-4" />
          ) : (
            <>
              <MoreHorizontal className="size-4" /> Actions
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isActive ? (
            <>
              {hideEdit ? null : (
                <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit consultation…</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => run(() => setConsultationStatus(consultationId, "completed"), "Marked completed")}>
                Mark completed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => setConsultationStatus(consultationId, "no_show"), "Marked no-show")}>
                Mark no-show
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onClick={() => setOutcomeOpen(true)}>Set outcome…</DropdownMenuItem>
          <DropdownMenuSeparator />
          {isActive ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => run(() => setConsultationStatus(consultationId, "canceled"), "Consultation canceled")}
            >
              Cancel consultation
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete consultation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hideEdit ? null : (
        <EditConsultationDialog consultationId={consultationId} open={editOpen} onOpenChange={setEditOpen} />
      )}
      <OutcomeDialog open={outcomeOpen} onOpenChange={setOutcomeOpen} consultationId={consultationId} current={outcome} />
      <DeleteConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} consultationId={consultationId} />
    </>
  )
}

function OutcomeDialog({
  open,
  onOpenChange,
  consultationId,
  current,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  consultationId: string
  current: string | null
}) {
  const outcomeId = React.useId()
  const { pending, run } = useRun()
  // Re-seed each open (the dialog stays mounted) so a cancel or a prior save doesn't leave a stale value
  // — adjusted during render on the open transition, not in an effect.
  const [value, setValue] = React.useState("")
  const [prevOpen, setPrevOpen] = React.useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setValue(current ?? "")
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    run(() => setConsultationOutcome(consultationId, value), "Outcome saved", () => onOpenChange(false))
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Set consultation outcome</DialogTitle>
            <DialogDescription>The post-consult qualification (e.g. qualified, not qualified, follow-up).</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Field label="Outcome" htmlFor={outcomeId}>
              <Input
                id={outcomeId}
                name="outcome"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Qualified to retain"
                autoComplete="off"
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save outcome"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  consultationId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  consultationId: string
}) {
  const { pending, run } = useRun()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete consultation?</DialogTitle>
          <DialogDescription>This permanently deletes the consultation. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => deleteConsultation(consultationId), "Consultation deleted", () => onOpenChange(false))}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
