import type * as React from "react"
import Link from "next/link"
import {
  CalendarClock,
  CircleDollarSign,
  Download,
  FileText,
  FolderKanban,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { CaseMixChart, ConsultationsChart, ConversionFunnelChart, RevenueChart } from "@/components/charts"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { StatusPill } from "@/components/status-pill"
import {
  ACTIVITY,
  CASE_TYPE_MIX,
  CONSULTATIONS,
  CONSULTATIONS_BY_MONTH,
  CONVERSION_FUNNEL,
  DEADLINES,
  KPIS,
  REVENUE_BY_MONTH,
  staffById,
  staffName,
} from "@/data"
import type { Activity } from "@/data/types"
import { formatDateTime } from "@/lib/format"
import { consultationStatusBadge, deadlineBadge } from "@/lib/status"

const ACTIVITY_ICON: Record<Activity["kind"], React.ComponentType<{ className?: string }>> = {
  lead: Users,
  consultation: CalendarClock,
  payment: CircleDollarSign,
  case: FolderKanban,
  document: FileText,
  message: MessageSquare,
}

export default function DashboardPage() {
  const upcoming = CONSULTATIONS.filter((c) =>
    ["scheduled", "paid", "rescheduled"].includes(c.status),
  )
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5)

  const deadlines = DEADLINES.slice()
    .sort((a, b) => a.dueInDays - b.dueInDays)
    .slice(0, 5)

  return (
    <>
      <PageHeader title="Dashboard" description="Firm-wide snapshot of leads, cases, and revenue.">
        <Button variant="outline" size="sm">
          <Download className="size-4" /> Export
        </Button>
        <Button size="sm" render={<Link href="/leads" />}>
          <Plus className="size-4" /> New lead
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* Trend charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
            <CardDescription>Monthly collected revenue, last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={REVENUE_BY_MONTH} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Consultation trends</CardTitle>
            <CardDescription>Booked vs. paid vs. qualified</CardDescription>
          </CardHeader>
          <CardContent>
            <ConsultationsChart data={CONSULTATIONS_BY_MONTH} />
          </CardContent>
        </Card>
      </div>

      {/* Funnel + mix */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead conversion funnel</CardTitle>
            <CardDescription>From first contact to retained client (last 90 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ConversionFunnelChart data={CONVERSION_FUNNEL} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Case type mix</CardTitle>
            <CardDescription>Active cases by practice area</CardDescription>
          </CardHeader>
          <CardContent>
            <CaseMixChart data={CASE_TYPE_MIX} />
          </CardContent>
        </Card>
      </div>

      {/* Operational lists */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming consultations */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming consultations</CardTitle>
            <CardAction>
              <Link href="/consultations" className="text-muted-foreground hover:text-foreground text-xs font-medium">
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {upcoming.map((c) => (
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
            ))}
          </CardContent>
        </Card>

        {/* Needs attention */}
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
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

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
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
