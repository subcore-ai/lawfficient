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
  rescheduleConsultation,
  setConsultationOutcome,
  setConsultationStatus,
  type ActionResult,
} from "@/app/(app)/consultations/actions"
import { Field } from "@/components/form-field"
import { utcToZonedInput } from "@/lib/consultations/time"
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
  startAt,
  timeZone,
  compact = false,
}: {
  consultationId: string
  status: ConsultationStatus
  outcome: string | null
  startAt: string
  timeZone: string
  compact?: boolean
}) {
  const { pending, run } = useRun()
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false)
  const [outcomeOpen, setOutcomeOpen] = React.useState(false)
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
              <DropdownMenuItem onClick={() => setRescheduleOpen(true)}>Reschedule…</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => setConsultationStatus(consultationId, "completed"), "Marked completed")}>
                Mark completed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => setConsultationStatus(consultationId, "no_show"), "Marked no-show")}>
                Mark no-show
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onClick={() => setOutcomeOpen(true)}>Set outcome…</DropdownMenuItem>
          {isActive ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => run(() => setConsultationStatus(consultationId, "canceled"), "Consultation canceled")}
              >
                Cancel consultation
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        consultationId={consultationId}
        startAt={startAt}
        timeZone={timeZone}
      />
      <OutcomeDialog open={outcomeOpen} onOpenChange={setOutcomeOpen} consultationId={consultationId} current={outcome} />
    </>
  )
}

function RescheduleDialog({
  open,
  onOpenChange,
  consultationId,
  startAt,
  timeZone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  consultationId: string
  startAt: string
  timeZone: string
}) {
  const startId = React.useId()
  const { pending, run } = useRun()
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const startAt = String(new FormData(e.currentTarget).get("startAt") ?? "")
    run(() => rescheduleConsultation(consultationId, startAt), "Consultation rescheduled", () => onOpenChange(false))
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Reschedule consultation</DialogTitle>
            <DialogDescription>Pick a new date and time. The consult is marked rescheduled.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Field label="New date &amp; time" htmlFor={startId}>
              <Input
                id={startId}
                name="startAt"
                type="datetime-local"
                defaultValue={utcToZonedInput(startAt, timeZone)}
                required
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Reschedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const outcome = String(new FormData(e.currentTarget).get("outcome") ?? "")
    run(() => setConsultationOutcome(consultationId, outcome), "Outcome saved", () => onOpenChange(false))
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
              <Input id={outcomeId} name="outcome" defaultValue={current ?? ""} placeholder="Qualified to retain" autoComplete="off" />
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
