"use client"

import * as React from "react"
import Link from "next/link"
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { toast } from "@workspace/ui/components/sonner"

import {
  assignLead,
  setLeadArchived,
  setLeadStatus,
} from "@/app/(app)/leads/actions"
import { DetailList, DetailRow } from "@/components/detail-list"
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog"
import { InlineSelect } from "@/components/inline-select"
import { NotesTimeline } from "@/components/notes/notes-timeline"
import { StatusPill } from "@/components/status-pill"
import type {
  AssigneeOption,
  LeadStatusView,
  LeadView,
} from "@/lib/leads/queries"
import type { NoteView } from "@/lib/notes/queries"
import { formatDate } from "@/lib/format"
import { qualificationBadge } from "@/lib/status"
import type { FirmTaxonomies } from "@/lib/taxonomies/queries"

const UNASSIGNED = "none"

type Result = { ok: true } | { error: string }

export function LeadDetail({
  lead,
  statuses,
  assignees,
  taxonomies,
  notes,
  currentUserId,
  canEdit,
  canManage,
}: {
  lead: LeadView
  statuses: LeadStatusView[]
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  notes: NoteView[]
  currentUserId: string | null
  canEdit: boolean
  canManage: boolean
}) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [, startTransition] = React.useTransition()

  const name = `${lead.firstName} ${lead.lastName}`
  const { data } = lead
  const statusOptions = statuses.map((s) => ({ value: s.id, label: s.name }))
  const inlineAssignee = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...assignees.map((a) => ({ value: a.id, label: a.name })),
  ]
  const assigneeName = lead.assignedToId
    ? (assignees.find((a) => a.id === lead.assignedToId)?.name ?? "—")
    : "Unassigned"

  function run(fn: () => Promise<Result>) {
    startTransition(async () => {
      const result = await fn()
      if ("error" in result) toast.error(result.error)
    })
  }

  function onArchive() {
    const next = !lead.archived
    startTransition(async () => {
      const result = await setLeadArchived(lead.id, next, name)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(next ? "Archived" : "Restored", { description: name })
    })
  }

  return (
    <>
      <Link
        href="/leads"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Leads
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={lead.status.name} tone={lead.status.tone} />
            {data.qualification ? (
              <StatusPill {...qualificationBadge(data.qualification)} />
            ) : null}
            {data.caseType ? (
              <StatusPill label={data.caseType} tone="neutral" />
            ) : null}
            {lead.archived ? (
              <StatusPill label="Archived" tone="neutral" />
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onArchive}>
              {lead.archived ? (
                <>
                  <ArchiveRestore className="size-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="size-4" /> Archive
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label="Phone">{lead.phone || "—"}</DetailRow>
              <DetailRow label="Email">{lead.email || "—"}</DetailRow>
              <DetailRow label="Location">
                {[data.city, data.state].filter(Boolean).join(", ") || "—"}
              </DetailRow>
              <DetailRow label="ZIP">{data.zip ?? "—"}</DetailRow>
              <DetailRow label="Country of origin">
                {data.countryOfOrigin ?? "—"}
              </DetailRow>
              <DetailRow label="Preferred language">
                {data.preferredLanguage ?? "—"}
              </DetailRow>
              <DetailRow label="Source">{lead.source}</DetailRow>
              <DetailRow label="Case type">
                {data.caseType ?? "Not set"}
              </DetailRow>
              <DetailRow label="Case hierarchy">
                {data.hierarchy ?? "Not set"}
              </DetailRow>
              <DetailRow label="Gender">{data.gender ?? "—"}</DetailRow>
              <DetailRow label="Date of birth">{data.dob ?? "—"}</DetailRow>
              <DetailRow label="Referral source">
                {data.referralSource ?? "—"}
              </DetailRow>
              <DetailRow label="Created">
                {formatDate(lead.createdAt)}
              </DetailRow>
              <DetailRow label="Last activity">
                {formatDate(lead.lastActivity)}
              </DetailRow>
            </DetailList>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status &amp; owner</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {canEdit ? (
                  <InlineSelect
                    value={lead.status.id}
                    options={statusOptions}
                    ariaLabel="Status"
                    onValueChange={(v) => run(() => setLeadStatus(lead.id, v))}
                  />
                ) : (
                  <StatusPill
                    label={lead.status.name}
                    tone={lead.status.tone}
                  />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Assigned to
                </span>
                {canEdit ? (
                  <InlineSelect
                    value={lead.assignedToId ?? UNASSIGNED}
                    options={inlineAssignee}
                    ariaLabel="Assignee"
                    onValueChange={(v) =>
                      run(() => assignLead(lead.id, v === UNASSIGNED ? "" : v))
                    }
                  />
                ) : (
                  <span className="text-sm">{assigneeName}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <NotesTimeline
                entityType="lead"
                entityId={lead.id}
                notes={notes}
                createdAt={lead.createdAt}
                currentUserId={currentUserId}
                canEdit={canEdit}
                isAdmin={canManage}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {canEdit ? (
        <EditLeadDialog
          lead={lead}
          assignees={assignees}
          taxonomies={taxonomies}
          canManage={canManage}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </>
  )
}
