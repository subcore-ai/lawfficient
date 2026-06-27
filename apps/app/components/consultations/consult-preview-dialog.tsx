"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { ConsultationActions } from "@/components/consultations/consultation-actions"
import { formatConsultationWhen } from "@/lib/consultations/time"
import type { ConsultationStatus } from "@/lib/consultations/validation"
import type { CalendarConsult } from "@/lib/scheduling/day-calendar"

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  paid: "Paid",
  completed: "Completed",
  rescheduled: "Rescheduled",
  canceled: "Canceled",
  no_show: "No-show",
}

// Click-through detail for a booked consult on the calendar — opens in place (no navigation). Shows the
// consult, links to the full case, and (for editors) exposes the shared manage actions (reschedule /
// complete / no-show / cancel / outcome / delete).
export function ConsultPreviewDialog({
  consult,
  open,
  onOpenChange,
  canManage,
}: {
  consult: CalendarConsult | null
  open: boolean
  onOpenChange: (o: boolean) => void
  canManage: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {consult ? (
          <>
            <DialogHeader>
              <DialogTitle>{consult.leadName}</DialogTitle>
              <DialogDescription>{consult.type}</DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-[5rem_1fr] gap-x-4 gap-y-2 py-2 text-sm">
              <dt className="text-muted-foreground">When</dt>
              <dd>{formatConsultationWhen(consult.startAt, consult.timeZone)}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{STATUS_LABEL[consult.status] ?? consult.status}</dd>
              {consult.outcome ? (
                <>
                  <dt className="text-muted-foreground">Outcome</dt>
                  <dd>{consult.outcome}</dd>
                </>
              ) : null}
            </dl>

            <DialogFooter className="flex-row items-center sm:justify-between">
              {consult.leadId ? (
                <Button variant="outline" size="sm" render={<Link href={`/leads/${consult.leadId}`} />}>
                  View full case <ArrowUpRight className="size-4" />
                </Button>
              ) : (
                <span />
              )}
              {canManage ? (
                <ConsultationActions
                  consultationId={consult.id}
                  status={consult.status as ConsultationStatus}
                  outcome={consult.outcome}
                  startAt={consult.startAt}
                  timeZone={consult.timeZone}
                />
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
