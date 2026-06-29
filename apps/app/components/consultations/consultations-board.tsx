"use client"

import Link from "next/link"
import { CalendarClock } from "lucide-react"

import { ConsultationActions } from "@/components/consultations/consultation-actions"
import { StatusPill } from "@/components/status-pill"
import { consultationStatusMeta, type ConsultationView } from "@/lib/consultations/queries"
import { formatConsultationWhen } from "@/lib/consultations/time"
import { formatCurrency } from "@/lib/format"

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

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {c.leadId ? (
            <Link href={`/leads/${c.leadId}`} className="block truncate text-sm font-medium hover:underline">
              {c.leadName}
            </Link>
          ) : (
            <p className="truncate text-sm font-medium">{c.leadName}</p>
          )}
          <p className="text-muted-foreground text-xs">{c.type}</p>
        </div>
        <StatusPill label={meta.label} tone={meta.tone} dot />
      </div>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <CalendarClock className="size-3.5 shrink-0" />
        {formatConsultationWhen(c.startAt, c.timeZone)} · {c.durationMin} min{c.attorneyName ? ` · ${c.attorneyName}` : ""}
      </p>

      <div className="flex items-center justify-between gap-2 text-xs">
        {c.paid && c.amount != null ? (
          <span className="tabular-nums">{formatCurrency(c.amount)}</span>
        ) : (
          <span className="text-muted-foreground">Unpaid</span>
        )}
        {c.outcome ? <span className="text-muted-foreground truncate">Outcome: {c.outcome}</span> : null}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <Link
          href={`/consultations/${c.id}`}
          className="text-muted-foreground hover:text-foreground text-xs hover:underline"
        >
          View details
        </Link>
        {canManage ? <ConsultationActions consultationId={c.id} status={c.status} outcome={c.outcome} /> : null}
      </div>
    </div>
  )
}
