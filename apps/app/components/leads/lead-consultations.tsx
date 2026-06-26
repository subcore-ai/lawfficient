"use client"

import * as React from "react"
import { CalendarClock } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import { ConsultationActions } from "@/components/consultations/consultation-actions"
import { StatusPill } from "@/components/status-pill"
import { consultationStatusMeta, type ConsultationView } from "@/lib/consultations/queries"
import { formatConsultationWhen } from "@/lib/consultations/time"
import { formatCurrency } from "@/lib/format"

type Attorney = { id: string; name: string }

// Filter options: the upcoming/past split (server-partitioned), "All", then each individual status.
// Defaults to "upcoming" so the card leads with what's actionable; the rest is one click away.
const STATUS_FILTERS = (["scheduled", "rescheduled", "completed", "no_show", "canceled"] as const).map((s) => ({
  value: s as string,
  label: consultationStatusMeta(s).label,
}))
const FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
  ...STATUS_FILTERS,
]

// The consultations booked against a lead, on the lead detail page. Defaults to upcoming; the header
// filter switches to past / all / a specific status. "Book" opens the shared dialog pre-scoped to this
// lead (triggerLeadId); the per-row kebab manages a consult.
export function LeadConsultations({
  leadId,
  upcoming,
  past,
  attorneys,
  defaultTimeZone,
  canManage,
}: {
  leadId: string
  upcoming: ConsultationView[]
  past: ConsultationView[]
  attorneys: Attorney[]
  defaultTimeZone: string | null
  canManage: boolean
}) {
  const [filter, setFilter] = React.useState("upcoming")
  const all = React.useMemo(() => [...upcoming, ...past], [upcoming, past])
  const shown = React.useMemo(() => {
    if (filter === "upcoming") return upcoming
    if (filter === "past") return past
    if (filter === "all") return all
    // "Scheduled" includes the combined "scheduled & paid" lifecycle state, so a paid consult (rendered
    // "Scheduled · paid") isn't hidden under the status filter.
    if (filter === "scheduled") return all.filter((c) => c.status === "scheduled" || c.status === "paid")
    return all.filter((c) => c.status === filter)
  }, [filter, upcoming, past, all])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultations</CardTitle>
        <CardAction className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v ?? "upcoming")} items={FILTERS}>
            <SelectTrigger className="h-8 w-[150px]" aria-label="Filter consultations">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage ? (
            <BookConsultationDialog
              leads={[]}
              attorneys={attorneys}
              triggerLeadId={leadId}
              defaultTimeZone={defaultTimeZone}
              label="Book"
            />
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent>
        {all.length === 0 ? (
          <p className="text-muted-foreground text-sm">No consultations booked yet.</p>
        ) : shown.length === 0 ? (
          <p className="text-muted-foreground text-sm">No consultations match this filter.</p>
        ) : (
          <ul className="divide-y">
            {shown.map((c) => (
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
