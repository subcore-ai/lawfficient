"use client"

import Link from "next/link"
import { ArrowLeft, Mail, Pencil, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { toast } from "@workspace/ui/components/sonner"

import { ActivityTimeline } from "@/components/activity-timeline"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EditConsultationDialog } from "@/components/consultations/edit-consultation-dialog"
import {
  PaymentDialog,
  ReceiptDialog,
  RescheduleDialog,
} from "@/components/consultations/consultation-dialogs"
import { DetailList, DetailRow } from "@/components/detail-list"
import { EntityRowActions } from "@/components/entity-row-actions"
import { StatusPill } from "@/components/status-pill"
import { ToastButton } from "@/components/toast-button"
import { staffName } from "@/data"
import { useStore } from "@/data/store"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { consultationStatusBadge } from "@/lib/status"

export function ConsultationDetail({ id }: { id: string }) {
  const { consultations, updateConsultation } = useStore()
  const c = consultations.find((x) => x.id === id)

  if (!c) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Link
          href="/consultations"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Consultations
        </Link>
        <p className="text-muted-foreground text-sm">Consultation not found.</p>
      </div>
    )
  }

  const active = ["scheduled", "paid", "rescheduled"].includes(c.status)

  return (
    <>
      <Link
        href="/consultations"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Consultations
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{c.leadName}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill {...consultationStatusBadge(c.status)} />
            <StatusPill label={c.type} tone="neutral" />
            {c.caseType ? <StatusPill label={c.caseType} tone="info" /> : null}
            {c.archived ? <StatusPill label="Archived" tone="neutral" /> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {active ? (
            <>
              <ToastButton variant="outline" size="sm" message="Confirmation resent" description={`Emailed to ${c.leadName}.`}>
                <Mail className="size-4" /> Resend
              </ToastButton>
              <RescheduleDialog consultation={c} />
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" size="sm">
                    <X className="size-4" /> Cancel
                  </Button>
                }
                title="Cancel this consultation?"
                description="The client and attorney will be notified and the slot freed up."
                confirmLabel="Cancel consultation"
                destructive
                onConfirm={() => {
                  updateConsultation(c.id, { status: "canceled" }, "Canceled consultation")
                  toast.success("Consultation canceled", { description: "Notifications sent." })
                }}
              />
            </>
          ) : null}
          <EditConsultationDialog
            consultation={c}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-4" /> Edit
              </Button>
            }
          />
          <EntityRowActions entity="consultation" id={c.id} label={c.leadName} archived={c.archived} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Consultation details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Client">{c.leadName}</DetailRow>
              <DetailRow label="Attorney">{staffName(c.attorneyId)}</DetailRow>
              <DetailRow label="Type">{c.type}</DetailRow>
              <DetailRow label="Date & time">{formatDateTime(c.startAt)}</DetailRow>
              <DetailRow label="Duration">{c.durationMin} min</DetailRow>
              <DetailRow label="Time zone">{c.timeZone}</DetailRow>
              <DetailRow label="Case type">{c.caseType ?? "Not set"}</DetailRow>
              <DetailRow label="Booked by">{staffName(c.bookedById)}</DetailRow>
            </DetailList>

            <Separator className="my-5" />
            <p className="text-muted-foreground text-xs">Attorney notes</p>
            <p className="mt-1 text-sm">
              {c.status === "completed"
                ? "Client appears eligible. Recommend proceeding with the engagement agreement; follow up with a code letter and battery chart."
                : "No notes recorded yet. Notes can be added after the consultation."}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {c.amount ? formatCurrency(c.amount) : "—"}
                </div>
                <div className="text-muted-foreground text-xs">
                  {c.paid ? "Paid in full" : c.amount ? "Payment due" : "Unpaid consultation"}
                </div>
              </div>
              {c.paid ? (
                <ReceiptDialog consultation={c} />
              ) : c.status === "canceled" ? (
                <p className="text-muted-foreground text-sm">Consultation canceled.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <PaymentDialog consultation={c} />
                  <PaymentDialog consultation={c} split />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline entity="consultation" id={c.id} label={c.leadName} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
