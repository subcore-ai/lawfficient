"use client"

import Link from "next/link"
import { ArrowLeft, CalendarClock, Pencil } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

import { ActivityTimeline } from "@/components/activity-timeline"
import { ConvertLeadDialog } from "@/components/leads/convert-lead-dialog"
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog"
import { QuoteLetterDialog } from "@/components/leads/quote-letter-dialog"
import { DetailList, DetailRow } from "@/components/detail-list"
import { EntityRowActions } from "@/components/entity-row-actions"
import { InlineSelect } from "@/components/inline-select"
import { StatusPill } from "@/components/status-pill"
import { LEAD_STATUS_LABELS, STAFF, staffName } from "@/data"
import { useStore } from "@/data/store"
import type { LeadStatus } from "@/data/types"
import { formatDate } from "@/lib/format"
import { leadStatusBadge, qualificationBadge } from "@/lib/status"

const STATUS_OPTIONS = Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const SALES_OPTIONS = STAFF.filter((u) => u.role === "sales").map((u) => ({ value: u.id, label: u.name }))

export function LeadDetail({ id }: { id: string }) {
  const { leads, updateLead } = useStore()
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

  const name = `${lead.firstName} ${lead.lastName}`

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
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill {...leadStatusBadge(lead.status)} />
            <StatusPill {...qualificationBadge(lead.qualification)} />
            {lead.caseType ? <StatusPill label={lead.caseType} tone="neutral" /> : null}
            {lead.archived ? <StatusPill label="Archived" tone="neutral" /> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/consultations" />}>
            <CalendarClock className="size-4" /> Book consultation
          </Button>
          <QuoteLetterDialog lead={lead} />
          {lead.status === "retained" ? null : <ConvertLeadDialog lead={lead} />}
          <EditLeadDialog
            lead={lead}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-4" /> Edit
              </Button>
            }
          />
          <EntityRowActions entity="lead" id={lead.id} label={name} archived={lead.archived} />
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
              <CardTitle>Status &amp; owner</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Status</span>
                <InlineSelect
                  value={lead.status}
                  options={STATUS_OPTIONS}
                  ariaLabel="Status"
                  onValueChange={(v) =>
                    updateLead(lead.id, { status: v as LeadStatus }, `Status → ${LEAD_STATUS_LABELS[v as LeadStatus]}`)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Assigned to</span>
                <InlineSelect
                  value={lead.assignedToId}
                  options={SALES_OPTIONS}
                  ariaLabel="Assignee"
                  onValueChange={(v) => updateLead(lead.id, { assignedToId: v }, `Reassigned to ${staffName(v)}`)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline entity="lead" id={lead.id} label={name} seedDate={lead.createdAt} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
