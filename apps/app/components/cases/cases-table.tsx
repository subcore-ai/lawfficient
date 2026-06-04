"use client"

import Link from "next/link"

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
import { StatusPill } from "@/components/status-pill"
import { DEADLINES, PACKET_STAGES, staffName } from "@/data"
import { useStore } from "@/data/store"
import { caseStatusBadge, redFlagBadge } from "@/lib/status"

export function CasesTable() {
  const { cases } = useStore()
  const redFlags = cases.filter((c) => c.redFlag !== "none").length
  const inReview = cases.filter((c) => c.status === "in_review").length
  const openDeadlines = DEADLINES.filter((d) => d.status === "open").length

  return (
    <div className="flex flex-col gap-4">
      <StatStrip
        stats={[
          { label: "Active cases", value: cases.length },
          { label: "In review", value: inReview },
          { label: "Red-flagged", value: redFlags, tone: redFlags ? "danger" : "default" },
          { label: "Open deadlines", value: openDeadlines, tone: openDeadlines ? "danger" : "default" },
        ]}
      />

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c) => {
              const flag = redFlagBadge(c.redFlag)
              return (
                <TableRow key={c.id} className="hover:bg-muted/40">
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
                    <div className="text-sm">Stage {c.stage}/10</div>
                    <div className="text-muted-foreground text-xs">{PACKET_STAGES[c.stage - 1] ?? ""}</div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm">{staffName(c.laId)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={c.checklistComplete} className="w-24" />
                      <span className="text-muted-foreground text-xs tabular-nums">{c.checklistComplete}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill {...caseStatusBadge(c.status)} />
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
