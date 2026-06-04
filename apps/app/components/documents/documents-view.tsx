"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { EditDocumentDialog } from "@/components/documents/edit-document-dialog"
import { EntityRowActions } from "@/components/entity-row-actions"
import { InlineSelect } from "@/components/inline-select"
import { ProgressBar } from "@/components/progress-bar"
import { DOC_STATUS_OPTIONS } from "@/components/select-field"
import { ShowArchivedToggle } from "@/components/show-archived-toggle"
import { StatStrip } from "@/components/stat-strip"
import { staffName } from "@/data"
import { useStore } from "@/data/store"
import type { DocItem } from "@/data/types"
import { formatDate } from "@/lib/format"

const statusLabel = (v: string) => DOC_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v

export function DocumentsView() {
  const { documents, cases, updateDocument } = useStore()
  const [showArchived, setShowArchived] = React.useState(false)

  const archivedCount = documents.filter((d) => d.archived).length
  const active = documents.filter((d) => !d.archived)
  const visible = documents.filter((d) => showArchived || !d.archived)
  const pending = active.filter((d) => d.status === "pending").length
  const verified = active.filter((d) => d.status === "verified").length
  const uscisMail = active.filter((d) => d.docType === "RFE" || d.docType === "NOID").length
  const checklists = cases
    .filter((c) => !c.archived)
    .slice()
    .sort((a, b) => a.checklistComplete - b.checklistComplete)
    .slice(0, 4)

  return (
    <>
      <StatStrip
        stats={[
          { label: "Documents", value: active.length },
          { label: "Pending verification", value: pending, tone: pending ? "danger" : "default" },
          { label: "Verified", value: verified, tone: "success" },
          { label: "RFE / NOID received", value: uscisMail },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Active submission checklists</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {checklists.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{c.clientName}</span>
                <span className="text-muted-foreground tabular-nums">{c.checklistComplete}%</span>
              </div>
              <ProgressBar value={c.checklistComplete} />
              <span className="text-muted-foreground text-xs">{c.caseType}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <ShowArchivedToggle checked={showArchived} onChange={setShowArchived} count={archivedCount} />
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Document</TableHead>
              <TableHead className="hidden md:table-cell">Client</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead className="hidden xl:table-cell">Uploaded by</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((d) => (
              <TableRow key={d.id} className={cn("hover:bg-muted/40", d.archived && "opacity-50")}>
                <TableCell>
                  <span className="font-medium">{d.name}</span>
                  <div className="text-muted-foreground text-xs md:hidden">{d.clientName}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{d.clientName}</TableCell>
                <TableCell className="text-muted-foreground hidden lg:table-cell">{d.category}</TableCell>
                <TableCell className="hidden xl:table-cell text-sm">{staffName(d.uploadedById)}</TableCell>
                <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                  {formatDate(d.uploadedAt)}
                </TableCell>
                <TableCell>
                  <InlineSelect
                    value={d.status}
                    options={DOC_STATUS_OPTIONS}
                    ariaLabel="Status"
                    onValueChange={(v) =>
                      updateDocument(d.id, { status: v as DocItem["status"] }, `Status → ${statusLabel(v)}`)
                    }
                  />
                </TableCell>
                <TableCell>
                  <EntityRowActions
                    entity="document"
                    id={d.id}
                    label={d.name}
                    archived={d.archived}
                    editDialog={(p) => <EditDocumentDialog document={d} {...p} />}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
