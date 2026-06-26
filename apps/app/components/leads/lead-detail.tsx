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
  setLeadQualification,
  setLeadStatus,
} from "@/app/(app)/leads/actions"
import { DetailList, DetailRow } from "@/components/detail-list"
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog"
import { InlineSelect } from "@/components/inline-select"
import { LocalTime } from "@/components/local-time"
import { LeadConsultations } from "@/components/leads/lead-consultations"
import { NoteComposer } from "@/components/notes/note-composer"
import { NotesTimeline } from "@/components/notes/notes-timeline"
import { StatusPill } from "@/components/status-pill"
import type { ConsultationView } from "@/lib/consultations/queries"
import { formatDate } from "@/lib/format"
import type {
  AssigneeOption,
  LeadStatusView,
  LeadView,
} from "@/lib/leads/queries"
import type { NoteView } from "@/lib/notes/queries"
import { qualificationBadge } from "@/lib/status"
import type { FirmTaxonomies } from "@/lib/taxonomies/queries"

const UNASSIGNED = "none"
// Sentinel for "clear qualification" — the reserved "__" prefix can't collide with a taxonomy label.
const NO_QUALIFICATION = "__none__"

type Result = { ok: true } | { error: string }
type Edits = {
  statusId: string
  assignedToId: string | null
  qualification: string | null
}

export function LeadDetail({
  lead,
  statuses,
  assignees,
  taxonomies,
  notes,
  currentUserId,
  currentUserName,
  canEdit,
  canManage,
  upcomingConsultations,
  pastConsultations,
  canViewConsultations,
  canManageConsultations,
  consultDefaultTimeZone,
}: {
  lead: LeadView
  statuses: LeadStatusView[]
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  notes: NoteView[]
  currentUserId: string | null
  currentUserName: string | null
  canEdit: boolean
  canManage: boolean
  upcomingConsultations: ConsultationView[]
  pastConsultations: ConsultationView[]
  canViewConsultations: boolean
  canManageConsultations: boolean
  consultDefaultTimeZone: string | null
}) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [, startTransition] = React.useTransition()

  // Optimistic overlay so inline edits + new notes show instantly instead of after the round-trip;
  // React reverts them if the action rejects (or the revalidated props come back unchanged).
  const [edits, applyEdit] = React.useOptimistic(
    {
      statusId: lead.status.id,
      assignedToId: lead.assignedToId,
      qualification: lead.data.qualification ?? null,
    },
    (state, patch: Partial<Edits>) => ({ ...state, ...patch }),
  )
  const [optimisticNotes, addOptimisticNote] = React.useOptimistic(
    notes,
    (prev, note: NoteView) => [note, ...prev],
  )

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

  // Qualification options = the firm's active labels, plus the lead's current value if it's been
  // deactivated, so it still renders.
  const qualificationOptions = [
    { value: NO_QUALIFICATION, label: "Not set" },
    ...taxonomies.qualification
      .filter((o) => o.isActive)
      .map((o) => ({ value: o.label, label: o.label })),
  ]
  if (
    lead.data.qualification &&
    !qualificationOptions.some((o) => o.value === lead.data.qualification)
  )
    qualificationOptions.push({
      value: lead.data.qualification,
      label: lead.data.qualification,
    })

  const optimisticStatus =
    statuses.find((s) => s.id === edits.statusId) ?? lead.status

  function run(patch: Partial<Edits>, fn: () => Promise<Result>) {
    startTransition(async () => {
      applyEdit(patch)
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
            <StatusPill
              label={optimisticStatus.name}
              tone={optimisticStatus.tone}
            />
            {edits.qualification ? (
              <StatusPill {...qualificationBadge(edits.qualification)} />
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
              <DetailRow label="Date of birth">{data.dob ? formatDate(data.dob) : "—"}</DetailRow>
              <DetailRow label="Referral source">
                {data.referralSource ?? "—"}
              </DetailRow>
              <DetailRow label="Created">
                <LocalTime iso={lead.createdAt} mode="date" />
              </DetailRow>
              <DetailRow label="Last activity">
                <LocalTime iso={lead.lastActivity} mode="date" />
              </DetailRow>
              <DetailRow label="Lead message" className="sm:col-span-2">
                {data.message ? (
                  <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words">{data.message}</p>
                ) : (
                  "—"
                )}
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
                    value={edits.statusId}
                    options={statusOptions}
                    ariaLabel="Status"
                    onValueChange={(v) =>
                      run({ statusId: v }, () => setLeadStatus(lead.id, v))
                    }
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
                    value={edits.assignedToId ?? UNASSIGNED}
                    options={inlineAssignee}
                    ariaLabel="Assignee"
                    onValueChange={(v) =>
                      run({ assignedToId: v === UNASSIGNED ? null : v }, () =>
                        assignLead(lead.id, v === UNASSIGNED ? "" : v),
                      )
                    }
                  />
                ) : (
                  <span className="text-sm">{assigneeName}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Qualification
                </span>
                {canEdit ? (
                  <InlineSelect
                    value={edits.qualification ?? NO_QUALIFICATION}
                    options={qualificationOptions}
                    ariaLabel="Qualification"
                    onValueChange={(v) =>
                      run(
                        { qualification: v === NO_QUALIFICATION ? null : v },
                        () =>
                          setLeadQualification(
                            lead.id,
                            v === NO_QUALIFICATION ? "" : v,
                          ),
                      )
                    }
                  />
                ) : lead.data.qualification ? (
                  <StatusPill
                    {...qualificationBadge(lead.data.qualification)}
                  />
                ) : (
                  <span className="text-sm">—</span>
                )}
              </div>
            </CardContent>
          </Card>

          {canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Add a note</CardTitle>
              </CardHeader>
              <CardContent>
                <NoteComposer
                  entityType="lead"
                  entityId={lead.id}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  onOptimisticAdd={addOptimisticNote}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {canViewConsultations ? (
        <LeadConsultations
          leadId={lead.id}
          upcoming={upcomingConsultations}
          past={pastConsultations}
          attorneys={assignees}
          defaultTimeZone={consultDefaultTimeZone}
          canManage={canManageConsultations}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <NotesTimeline
            notes={optimisticNotes}
            createdAt={lead.createdAt}
            currentUserId={currentUserId}
            canEdit={canEdit}
            isAdmin={canManage}
          />
        </CardContent>
      </Card>

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
