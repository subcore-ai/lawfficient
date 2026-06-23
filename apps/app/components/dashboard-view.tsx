"use client"

import type * as React from "react"
import Link from "next/link"
import {
  CalendarClock,
  CircleDollarSign,
  Download,
  FileText,
  FolderKanban,
  MessageSquare,
  Users,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { CaseMixChart, ConsultationsChart, ConversionFunnelChart, RevenueChart } from "@/components/charts"
import { MockTag } from "@/components/dev/mock-tag"
import { KpiCard } from "@/components/kpi-card"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import { PageHeader } from "@/components/page-header"
import { StatusPill } from "@/components/status-pill"
import { ToastButton } from "@/components/toast-button"
import type { FirmTaxonomies } from "@/lib/taxonomies/queries"
import {
  ACTIVITY,
  CASE_TYPE_MIX,
  CONSULTATIONS_BY_MONTH,
  CONVERSION_FUNNEL,
  DEADLINES,
  REVENUE_BY_MONTH,
  staffById,
  staffName,
} from "@/data"
import { useStore } from "@/data/store"
import type { Activity, Kpi } from "@/data/types"
import type { AssigneeOption } from "@/lib/leads/queries"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { consultationStatusBadge, deadlineBadge } from "@/lib/status"

const ACTIVITY_ICON: Record<Activity["kind"], React.ComponentType<{ className?: string }>> = {
  lead: Users,
  consultation: CalendarClock,
  payment: CircleDollarSign,
  case: FolderKanban,
  document: FileText,
  message: MessageSquare,
}

// The two lead KPIs (openLeads/eaOut) come from real Supabase counts via the RSC page; the
// remaining KPIs, charts, and lists stay on the mock store until those domains are wired.
export function DashboardView({
  openLeads,
  eaOut,
  assignees,
  taxonomies,
  canCreateLead,
  canManage,
}: {
  openLeads: number
  eaOut: number
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  canCreateLead: boolean
  canManage: boolean
}) {
  const { consultations, clients, cases, invoices } = useStore()

  const upcoming = consultations
    .filter((c) => ["scheduled", "paid", "rescheduled"].includes(c.status))
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  const overdue = invoices.filter((i) => i.status === "overdue").reduce((sum, i) => sum + i.remaining, 0)
  const redFlags = cases.filter((c) => c.redFlag !== "none").length

  // openLeads + eaOut are real Supabase counts; the rest are still derived from the mock store.
  const kpis: { kpi: Kpi; mock?: boolean }[] = [
    { kpi: { label: "Leads in pipeline", value: String(openLeads), delta: 0, hint: "active leads" } },
    { kpi: { label: "Upcoming consultations", value: String(upcoming.length), delta: 20, hint: "scheduled & paid" }, mock: true },
    { kpi: { label: "Pending retainers (EA out)", value: String(eaOut), delta: 0, hint: "awaiting signature" } },
    { kpi: { label: "Retained clients", value: String(clients.length), delta: 9.1, hint: "active engagements" }, mock: true },
    { kpi: { label: "Overdue balance", value: formatCurrency(overdue), delta: 4.2, hint: "across clients" }, mock: true },
    { kpi: { label: "Red-flag cases", value: String(redFlags), delta: 0, hint: "need attention" }, mock: true },
  ]

  const deadlines = DEADLINES.slice().sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 5)

  return (
    <>
      <PageHeader title="Dashboard" description="Firm-wide snapshot of leads, cases, and revenue.">
        <ToastButton variant="outline" size="sm" message="Dashboard exported" description="Downloaded as PDF.">
          <Download className="size-4" /> Export
        </ToastButton>
        {canCreateLead ? <NewLeadDialog assignees={assignees} taxonomies={taxonomies} canManage={canManage} /> : null}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map(({ kpi, mock }) => (
          <KpiCard key={kpi.label} kpi={kpi} mock={mock} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Revenue trend
              <MockTag />
            </CardTitle>
            <CardDescription>Monthly collected revenue, last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={REVENUE_BY_MONTH} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Consultation trends
              <MockTag />
            </CardTitle>
            <CardDescription>Booked vs. paid vs. qualified</CardDescription>
          </CardHeader>
          <CardContent>
            <ConsultationsChart data={CONSULTATIONS_BY_MONTH} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Lead conversion funnel
              <MockTag />
            </CardTitle>
            <CardDescription>From first contact to retained client (last 90 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ConversionFunnelChart data={CONVERSION_FUNNEL} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Case type mix
              <MockTag />
            </CardTitle>
            <CardDescription>Active cases by practice area</CardDescription>
          </CardHeader>
          <CardContent>
            <CaseMixChart data={CASE_TYPE_MIX} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Upcoming consultations
              <MockTag />
            </CardTitle>
            <CardAction>
              <Link href="/consultations" className="text-muted-foreground hover:text-foreground text-xs font-medium">
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming consultations.</p>
            ) : (
              upcoming.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar className="size-8 rounded-md">
                    <AvatarFallback className="rounded-md text-xs">
                      {staffById(c.attorneyId)?.initials ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.leadName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {staffName(c.attorneyId)} · {formatDateTime(c.startAt)}
                    </p>
                  </div>
                  <StatusPill {...consultationStatusBadge(c.status)} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Needs attention
              <MockTag />
            </CardTitle>
            <CardAction>
              <Link href="/cases/deadlines" className="text-muted-foreground hover:text-foreground text-xs font-medium">
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {deadlines.map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {d.kind} · {d.clientName}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{staffName(d.laId)}</p>
                </div>
                <StatusPill {...deadlineBadge(d)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Recent activity
              <MockTag />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5">
            {ACTIVITY.map((a) => {
              const Icon = ACTIVITY_ICON[a.kind]
              return (
                <div key={a.id} className="flex gap-3">
                  <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{a.text}</p>
                    <p className="text-muted-foreground text-xs">{a.at}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
