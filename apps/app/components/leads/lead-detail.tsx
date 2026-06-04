"use client"

import Link from "next/link"
import { ArrowLeft, CalendarClock } from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

import { ConvertLeadDialog } from "@/components/leads/convert-lead-dialog"
import { QuoteLetterDialog } from "@/components/leads/quote-letter-dialog"
import { DetailList, DetailRow } from "@/components/detail-list"
import { StatusPill } from "@/components/status-pill"
import { ROLE_LABELS, staffById, staffName } from "@/data"
import { useStore } from "@/data/store"
import { formatDate } from "@/lib/format"
import { leadStatusBadge, qualificationBadge } from "@/lib/status"

export function LeadDetail({ id }: { id: string }) {
  const { leads } = useStore()
  const lead = leads.find((l) => l.id === id)

  if (!lead) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Link
          href="/leads"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Leads
        </Link>
        <p className="text-muted-foreground text-sm">Lead not found.</p>
      </div>
    )
  }

  const assignee = staffById(lead.assignedToId)
  const timeline = [
    { label: `Lead created from ${lead.source}`, at: lead.createdAt },
    { label: `Assigned to ${staffName(lead.assignedToId)}`, at: lead.createdAt },
    ...(lead.status !== "new" ? [{ label: "First contact attempted", at: lead.lastActivity }] : []),
    ...(lead.qualification === "qualified"
      ? [{ label: "Marked qualified by attorney", at: lead.lastActivity }]
      : []),
    ...(lead.status === "retained"
      ? [{ label: "Converted to retained client", at: lead.lastActivity }]
      : []),
  ]

  return (
    <>
      <Link
        href="/leads"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Leads
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {lead.firstName} {lead.lastName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill {...leadStatusBadge(lead.status)} />
            <StatusPill {...qualificationBadge(lead.qualification)} />
            {lead.caseType ? <StatusPill label={lead.caseType} tone="neutral" /> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/consultations" />}>
            <CalendarClock className="size-4" /> Book consultation
          </Button>
          <QuoteLetterDialog lead={lead} />
          {lead.status === "retained" ? null : <ConvertLeadDialog lead={lead} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Phone">{lead.phone || "—"}</DetailRow>
              <DetailRow label="Email">{lead.email}</DetailRow>
              <DetailRow label="Location">
                {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
              </DetailRow>
              <DetailRow label="Country of origin">{lead.countryOfOrigin || "—"}</DetailRow>
              <DetailRow label="Preferred language">{lead.preferredLanguage}</DetailRow>
              <DetailRow label="Source">{lead.source}</DetailRow>
              <DetailRow label="Case type">{lead.caseType ?? "Not set"}</DetailRow>
              <DetailRow label="Case hierarchy">{lead.hierarchy ?? "Not set"}</DetailRow>
              <DetailRow label="Created">{formatDate(lead.createdAt)}</DetailRow>
              <DetailRow label="Last activity">{formatDate(lead.lastActivity)}</DetailRow>
            </DetailList>
            {lead.notes ? (
              <>
                <Separator className="my-5" />
                <p className="text-muted-foreground text-xs">Notes</p>
                <p className="mt-1 text-sm">{lead.notes}</p>
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Avatar className="size-9 rounded-md">
                <AvatarFallback className="bg-primary text-primary-foreground rounded-md text-xs">
                  {assignee?.initials ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{staffName(lead.assignedToId)}</p>
                <p className="text-muted-foreground text-xs">
                  {assignee ? ROLE_LABELS[assignee.role] : "Unassigned"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative flex flex-col gap-4 border-l pl-4">
                {timeline.map((entry, i) => (
                  <li key={i} className="relative">
                    <span className="bg-primary absolute top-1 -left-[1.3rem] size-2 rounded-full ring-4 ring-background" />
                    <p className="text-sm leading-snug">{entry.label}</p>
                    <p className="text-muted-foreground text-xs">{formatDate(entry.at)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
