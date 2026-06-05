"use client"

import * as React from "react"
import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { EditCaseDialog } from "@/components/cases/edit-case-dialog"
import { EntityRowActions } from "@/components/entity-row-actions"
import { InlineSelect } from "@/components/inline-select"
import { ProgressBar } from "@/components/progress-bar"
import { CASE_STATUS_OPTIONS } from "@/components/select-field"
import { ShowArchivedToggle } from "@/components/show-archived-toggle"
import { StatStrip } from "@/components/stat-strip"
import { StatusPill } from "@/components/status-pill"
import { DEADLINES, staffName } from "@/data"
import { useStore } from "@/data/store"
import type { CaseStatus } from "@/data/types"
import { redFlagBadge } from "@/lib/status"

const statusLabel = (v: string) => CASE_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v

export function CasesTable() {
  const { cases, updateCase, packetPipeline } = useStore()
  const [showArchived, setShowArchived] = React.useState(false)

  const archivedCount = cases.filter((c) => c.archived).length
  const visible = cases.filter((c) => showArchived || !c.archived)
  const active = cases.filter((c) => !c.archived)
  const redFlags = active.filter((c) => c.redFlag !== "none").length
  const inReview = active.filter((c) => c.status === "in_review").length
  const openDeadlines = DEADLINES.filter((d) => d.status === "open").length

  return (
    <div className="flex flex-col gap-4">
      <StatStrip
        stats={[
          { label: "Active cases", value: active.length },
          { label: "In review", value: inReview },
          { label: "Red-flagged", value: redFlags, tone: redFlags ? "danger" : "default" },
          { label: "Open deadlines", value: openDeadlines, tone: openDeadlines ? "danger" : "default" },
        ]}
      />

      <div className="flex justify-end">
        <ShowArchivedToggle checked={showArchived} onChange={setShowArchived} count={archivedCount} />
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Client</TableHead>
              <TableHead className="hidden lg:table-cell">Case type</TableHead>
              <TableHead className="hidden md:table-cell">Stage</TableHead>
              <TableHead className="hidden xl:table-cell">Legal assistant</TableHead>
              <TableHead className="hidden lg:table-cell">Checklist</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((c) => {
              const flag = redFlagBadge(c.redFlag)
              return (
                <TableRow key={c.id} className={cn("hover:bg-muted/40", c.archived && "opacity-50")}>
                  <TableCell>
                    <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                      {c.clientName}
                    </Link>
                    {flag ? (
                      <div className="mt-1">
                        <StatusPill {...flag} dot />
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{c.caseType}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm">Stage {c.stage}/{packetPipeline.length}</div>
                    <div className="text-muted-foreground text-xs">{packetPipeline[c.stage - 1]?.name ?? ""}</div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm">{staffName(c.laId)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={c.checklistComplete} className="w-24" />
                      <span className="text-muted-foreground text-xs tabular-nums">{c.checklistComplete}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <InlineSelect
                      value={c.status}
                      options={CASE_STATUS_OPTIONS}
                      ariaLabel="Status"
                      onValueChange={(v) =>
                        updateCase(c.id, { status: v as CaseStatus }, `Status → ${statusLabel(v)}`)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <EntityRowActions
                      entity="case"
                      id={c.id}
                      label={c.clientName}
                      archived={c.archived}
                      editDialog={(p) => <EditCaseDialog caseItem={c} {...p} />}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
