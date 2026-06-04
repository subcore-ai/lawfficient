"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { ProgressBar } from "@/components/progress-bar"
import { StatStrip } from "@/components/stat-strip"
import { StatusPill, type Tone } from "@/components/status-pill"
import { staffName } from "@/data"
import { useStore } from "@/data/store"
import type { DocItem } from "@/data/types"
import { formatDate } from "@/lib/format"

const DOC_STATUS: Record<DocItem["status"], { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  submitted: { label: "Submitted", tone: "info" },
  verified: { label: "Verified", tone: "success" },
}

export function DocumentsView() {
  const { documents, cases } = useStore()
  const pending = documents.filter((d) => d.status === "pending").length
  const verified = documents.filter((d) => d.status === "verified").length
  const uscisMail = documents.filter((d) => d.docType === "RFE" || d.docType === "NOID").length
  const checklists = cases.slice().sort((a, b) => a.checklistComplete - b.checklistComplete).slice(0, 4)

  return (
    <>
      <StatStrip
        stats={[
          { label: "Documents", value: documents.length },
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((d) => (
              <TableRow key={d.id} className="hover:bg-muted/40">
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
                  <StatusPill {...DOC_STATUS[d.status]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
