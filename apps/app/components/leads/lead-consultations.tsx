"use client"

import { CalendarClock } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import { ConsultationActions } from "@/components/consultations/consultation-actions"
import { StatusPill } from "@/components/status-pill"
import { consultationStatusMeta, type ConsultationView } from "@/lib/consultations/queries"
import { formatConsultationWhen } from "@/lib/consultations/time"
import { formatCurrency } from "@/lib/format"

type Attorney = { id: string; name: string }

// The consultations booked against a lead, shown on the lead detail page. Rows are read-only (there's
// no per-consultation page yet); the header offers "Book", which opens the shared dialog pre-scoped to
// this lead via triggerLeadId. `consultations` arrives ordered start_at desc (upcoming first, then past).
export function LeadConsultations({
  leadId,
  consultations,
  attorneys,
  defaultTimeZone,
  canManage,
}: {
  leadId: string
  consultations: ConsultationView[]
  attorneys: Attorney[]
  defaultTimeZone: string | null
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultations</CardTitle>
        {canManage ? (
          <CardAction>
            <BookConsultationDialog
              leads={[]}
              attorneys={attorneys}
              triggerLeadId={leadId}
              defaultTimeZone={defaultTimeZone}
              label="Book"
            />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {consultations.length === 0 ? (
          <p className="text-muted-foreground text-sm">No consultations booked yet.</p>
        ) : (
          <ul className="divide-y">
            {consultations.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.type}</p>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                    <CalendarClock className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {formatConsultationWhen(c.startAt, c.timeZone)}
                      {c.attorneyName ? ` · ${c.attorneyName}` : ""}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.paid && c.amount != null ? (
                    <span className="text-muted-foreground text-xs tabular-nums">{formatCurrency(c.amount)}</span>
                  ) : null}
                  <StatusPill {...consultationStatusMeta(c.status)} dot />
                  {canManage ? (
                    <ConsultationActions
                      consultationId={c.id}
                      status={c.status}
                      outcome={c.outcome}
                      startAt={c.startAt}
                      timeZone={c.timeZone}
                      compact
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
