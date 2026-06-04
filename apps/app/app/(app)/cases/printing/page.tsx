"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { PageHeader } from "@/components/page-header"
import { StatStrip } from "@/components/stat-strip"
import { StatusPill } from "@/components/status-pill"
import { PACKET_STAGES, staffName } from "@/data"
import { useStore } from "@/data/store"

export default function PrintingQueuePage() {
  const { cases, updateCase } = useStore()
  const queue = cases.filter((c) => c.stage >= 6).slice().sort((a, b) => b.stage - a.stage)
  const mailed = queue.filter((c) => c.stage >= 10).length

  return (
    <>
      <Link
        href="/cases"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Cases
      </Link>

      <PageHeader
        title="Packet printing queue"
        description="File-clerk view of packets ready to print, review, and mail (Stage 6+)."
      />

      <StatStrip
        stats={[
          { label: "In queue", value: queue.length },
          { label: "Awaiting mailing", value: queue.length - mailed },
          { label: "Mailed", value: mailed, tone: "success" },
        ]}
      />

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Case type</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="hidden lg:table-cell">Legal assistant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  No packets are ready for printing yet.
                </TableCell>
              </TableRow>
            ) : (
              queue.map((c) => {
                const isMailed = c.stage >= 10
                return (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell>
                      <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                        {c.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{c.caseType}</TableCell>
                    <TableCell>
                      <div className="text-sm">Stage {c.stage}/10</div>
                      <div className="text-muted-foreground text-xs">{PACKET_STAGES[c.stage - 1] ?? ""}</div>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{staffName(c.laId)}</TableCell>
                    <TableCell>
                      <StatusPill
                        label={isMailed ? "Mailed to USCIS" : "In queue"}
                        tone={isMailed ? "success" : "warning"}
                        dot
                      />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {isMailed ? (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          # 9405 5118 9876
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            updateCase(c.id, { stage: 10, status: "filed" })
                            toast.success("Packet mailed to USCIS", {
                              description: `Tracking number saved for ${c.clientName}.`,
                            })
                          }}
                        >
                          Mark mailed
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
