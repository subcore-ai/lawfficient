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

import { UserAvatar } from "@/components/user-avatar"
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
import { consultationStatusMeta } from "@/lib/consultations/queries"
import { formatConsultationWhen } from "@/lib/consultations/time"
import type { ConsultationStatus } from "@/lib/consultations/validation"
import type { FirmTaxonomies } from "@/lib/taxonomies/queries"
import {
  ACTIVITY,
  CASE_TYPE_MIX,
  CONSULTATIONS_BY_MONTH,
  CONVERSION_FUNNEL,
  DEADLINES,
  REVENUE_BY_MONTH,
  staffName,
} from "@/data"
import { useStore } from "@/data/store"
import type { Activity, Kpi } from "@/data/types"
import type { AssigneeOption } from "@/lib/leads/queries"
import { formatCurrency } from "@/lib/format"
import { deadlineBadge } from "@/lib/status"

// One real upcoming consultation, shaped for the dashboard list (loaded server-side in the RSC page).
export type UpcomingConsultation = {
  id: string
  leadId: string | null
  leadName: string
  attorneyName: string | null
  status: ConsultationStatus
  startAt: string
  timeZone: string
}

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
  leadKpisMock,
  assignees,
  taxonomies,
  upcomingConsultations,
  canCreateLead,
  canManage,
}: {
  openLeads: number
  eaOut: number
  leadKpisMock: boolean
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  upcomingConsultations: UpcomingConsultation[]
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

  // openLeads + eaOut are real Supabase counts — unless the viewer lacks leads.view, in which case
  // they fall back to mock counts (leadKpisMock) like the rest of the dashboard.
  const kpis: { kpi: Kpi; mock?: boolean }[] = [
    { kpi: { label: "Leads in pipeline", value: String(openLeads), delta: 0, hint: "active leads" }, mock: leadKpisMock },
    { kpi: { label: "Upcoming consultations", value: String(upcoming.length), delta: 20, hint: "scheduled & paid" }, mock: true },
    { kpi: { label: "Pending retainers (EA out)", value: String(eaOut), delta: 0, hint: "awaiting signature" }, mock: leadKpisMock },
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
            </CardTitle>
            <CardAction>
              <Link href="/consultations?view=list" className="text-muted-foreground hover:text-foreground text-xs font-medium">
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {upcomingConsultations.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming consultations.</p>
            ) : (
              upcomingConsultations.map((c) => {
                const meta = consultationStatusMeta(c.status)
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <UserAvatar name={c.attorneyName ?? "Unassigned"} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.leadName}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {c.attorneyName ?? "Unassigned"} · {formatConsultationWhen(c.startAt, c.timeZone)}
                      </p>
                    </div>
                    <StatusPill label={meta.label} tone={meta.tone} />
                  </div>
                )
              })
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
