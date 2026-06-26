"use client"

import * as React from "react"
import { CalendarClock, MoreHorizontal } from "lucide-react"

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
import { StatusPill } from "@/components/status-pill"
import { consultationStatusMeta, type ConsultationView } from "@/lib/consultations/queries"
import { formatCurrency, formatDateTime } from "@/lib/format"

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

export function ConsultationsBoard({
  upcoming,
  past,
  canManage,
}: {
  upcoming: ConsultationView[]
  past: ConsultationView[]
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-8">
      <Section title="Upcoming" items={upcoming} empty="No upcoming consultations." canManage={canManage} />
      <Section title="Past" items={past} empty="No past consultations yet." canManage={canManage} />
    </div>
  )
}

function Section({
  title,
  items,
  empty,
  canManage,
}: {
  title: string
  items: ConsultationView[]
  empty: string
  canManage: boolean
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
        {title}
        <span className="text-muted-foreground/70">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((c) => (
            <ConsultationCard key={c.id} consultation={c} canManage={canManage} />
          ))}
        </div>
      )}
    </section>
  )
}

function ConsultationCard({ consultation: c, canManage }: { consultation: ConsultationView; canManage: boolean }) {
  const meta = consultationStatusMeta(c.status)
  const { pending, run } = useRun()
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false)
  const [outcomeOpen, setOutcomeOpen] = React.useState(false)
  // Reschedule / cancel / complete / no-show only apply to a live consult; a terminal one
  // (completed / canceled / no-show) can still have its outcome recorded.
  const isActive = c.status === "scheduled" || c.status === "paid" || c.status === "rescheduled"

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{c.leadName}</p>
          <p className="text-muted-foreground text-xs">{c.type}</p>
        </div>
        <StatusPill label={meta.label} tone={meta.tone} dot />
      </div>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <CalendarClock className="size-3.5 shrink-0" />
        {formatDateTime(c.startAt)} · {c.durationMin} min{c.attorneyName ? ` · ${c.attorneyName}` : ""}
      </p>

      <div className="flex items-center justify-between gap-2 text-xs">
        {c.paid && c.amount != null ? (
          <span className="tabular-nums">{formatCurrency(c.amount)}</span>
        ) : (
          <span className="text-muted-foreground">Unpaid</span>
        )}
        {c.outcome ? <span className="text-muted-foreground truncate">Outcome: {c.outcome}</span> : null}
      </div>

      {canManage ? (
        <div className="mt-1">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" disabled={pending} />}>
              <MoreHorizontal className="size-4" /> Actions
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {isActive ? (
                <>
                  <DropdownMenuItem onClick={() => setRescheduleOpen(true)}>Reschedule…</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => run(() => setConsultationStatus(c.id, "completed"), "Marked completed")}>
                    Mark completed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => run(() => setConsultationStatus(c.id, "no_show"), "Marked no-show")}>
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
                    onClick={() => run(() => setConsultationStatus(c.id, "canceled"), "Consultation canceled")}
                  >
                    Cancel consultation
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <RescheduleDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} consultationId={c.id} />
      <OutcomeDialog open={outcomeOpen} onOpenChange={setOutcomeOpen} consultationId={c.id} current={c.outcome} />
    </div>
  )
}

function RescheduleDialog({
  open,
  onOpenChange,
  consultationId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  consultationId: string
}) {
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
            <Field label="New date &amp; time">
              <Input name="startAt" type="datetime-local" required />
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
            <Field label="Outcome">
              <Input name="outcome" defaultValue={current ?? ""} placeholder="Qualified to retain" autoComplete="off" />
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
