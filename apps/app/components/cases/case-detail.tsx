"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { toast } from "@workspace/ui/components/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { ActivityTimeline } from "@/components/activity-timeline"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { DeclarationTab } from "@/components/cases/declaration-tab"
import { DocumentChecklist } from "@/components/cases/document-checklist"
import { EditCaseDialog } from "@/components/cases/edit-case-dialog"
import { QaChecklist } from "@/components/cases/qa-checklist"
import { SignOffs } from "@/components/cases/sign-offs"
import { SendUpdateDialog } from "@/components/cases/send-update-dialog"
import { DetailList, DetailRow } from "@/components/detail-list"
import { EntityRowActions } from "@/components/entity-row-actions"
import { InlineSelect } from "@/components/inline-select"
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog"
import { ProgressBar } from "@/components/progress-bar"
import { CASE_STATUS_OPTIONS } from "@/components/select-field"
import { StageTracker } from "@/components/stage-tracker"
import { StatusPill } from "@/components/status-pill"
import { DEADLINES, PACKET_STAGES, staffName, TASKS } from "@/data"
import { useStore } from "@/data/store"
import type { CaseStatus } from "@/data/types"
import { formatDate } from "@/lib/format"
import { deadlineBadge, priorityBadge, redFlagBadge } from "@/lib/status"

const statusLabel = (v: string) => CASE_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v

export function CaseDetail({ id }: { id: string }) {
  const { cases, updateCase } = useStore()
  const c = cases.find((x) => x.id === id)

  if (!c) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Link
          href="/cases"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Cases
        </Link>
        <p className="text-muted-foreground text-sm">Case not found.</p>
      </div>
    )
  }

  const tasks = TASKS.filter((t) => t.caseId === c.id)
  const deadlines = DEADLINES.filter((d) => d.caseId === c.id)
  const flag = redFlagBadge(c.redFlag)
  const needsDeclaration = c.caseType.startsWith("VAWA")

  return (
    <>
      <Link
        href="/cases"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Cases
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{c.clientName}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={c.caseType} tone="neutral" />
            <InlineSelect
              value={c.status}
              options={CASE_STATUS_OPTIONS}
              ariaLabel="Status"
              onValueChange={(v) => updateCase(c.id, { status: v as CaseStatus }, `Status → ${statusLabel(v)}`)}
            />
            {flag ? <StatusPill {...flag} dot /> : null}
            {c.archived ? <StatusPill label="Archived" tone="neutral" /> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UploadDocumentDialog defaultClientName={c.clientName} defaultCaseType={c.caseType} caseId={c.id} />
          <SendUpdateDialog clientName={c.clientName} />
          <EditCaseDialog
            caseItem={c}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-4" /> Edit
              </Button>
            }
          />
          {c.stage < 10 ? (
            <ConfirmDialog
              trigger={
                <Button size="sm">
                  <ArrowRight className="size-4" /> Advance stage
                </Button>
              }
              title={`Advance to stage ${c.stage + 1}?`}
              description="Confirm the sign-off sheet is uploaded. The next owner will be notified and a task created."
              confirmLabel="Advance stage"
              onConfirm={() => {
                updateCase(c.id, { stage: c.stage + 1 }, `Advanced to stage ${c.stage + 1}`)
                toast.success(`Advanced to stage ${c.stage + 1}`, {
                  description: "Next owner notified; a task was created.",
                })
              }}
            />
          ) : null}
          <EntityRowActions entity="case" id={c.id} label={c.clientName} archived={c.archived} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checklist">Checklist &amp; QA</TabsTrigger>
          <TabsTrigger value="declaration">Declaration</TabsTrigger>
          <TabsTrigger value="signoffs">Sign-offs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Case overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <DetailList>
                    <DetailRow label="Case type">{c.caseType}</DetailRow>
                    <DetailRow label="Hierarchy">{c.hierarchy}</DetailRow>
                    <DetailRow label="Difficulty">Level {c.difficulty}</DetailRow>
                    <DetailRow label="Legal assistant">{staffName(c.laId)}</DetailRow>
                    <DetailRow label="Attorney">{staffName(c.attorneyId)}</DetailRow>
                    <DetailRow label="Date hired">{formatDate(c.dateHired)}</DetailRow>
                    <DetailRow label="Expected mailing">{formatDate(c.expectedMailing)}</DetailRow>
                    <DetailRow label="Packet stage">Stage {c.stage} of 10</DetailRow>
                  </DetailList>
                  <Separator className="my-5" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Document checklist</span>
                    <span className="font-medium tabular-nums">{c.checklistComplete}%</span>
                  </div>
                  <ProgressBar value={c.checklistComplete} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tasks</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {tasks.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No open tasks for this case.</p>
                  ) : (
                    tasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.title}</p>
                          <p className="text-muted-foreground text-xs">
                            {staffName(t.assigneeId)} · {t.dueLabel}
                          </p>
                        </div>
                        <StatusPill {...priorityBadge(t.priority)} />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {deadlines.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Deadlines</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {deadlines.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{d.kind}</p>
                          <p className="text-muted-foreground text-xs">Due {formatDate(d.dueAt)}</p>
                        </div>
                        <StatusPill {...deadlineBadge(d)} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Packet stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <StageTracker stages={PACKET_STAGES} current={c.stage} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityTimeline entity="case" id={c.id} label={c.clientName} seedDate={c.dateHired} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Document submission</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentChecklist caseId={c.id} caseType={c.caseType} initialComplete={c.checklistComplete} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>QA review</CardTitle>
              </CardHeader>
              <CardContent>
                <QaChecklist caseName={c.clientName} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="declaration" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Declaration lifecycle</CardTitle>
            </CardHeader>
            <CardContent>
              <DeclarationTab requiresDeclaration={needsDeclaration} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signoffs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sign-off sheets</CardTitle>
            </CardHeader>
            <CardContent>
              <SignOffs stage={c.stage} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
