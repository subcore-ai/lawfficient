import Link from "next/link"

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
import { DEADLINES, staffName } from "@/data"
import { formatDate } from "@/lib/format"
import { deadlineBadge } from "@/lib/status"

export const metadata = { title: "Deadlines" }

export default function DeadlinesPage() {
  const deadlines = DEADLINES.slice().sort((a, b) => a.dueInDays - b.dueInDays)
  const overdue = deadlines.filter((d) => d.status === "overdue" || d.dueInDays < 0).length
  const thisWeek = deadlines.filter((d) => d.dueInDays >= 0 && d.dueInDays <= 7).length

  return (
    <>
      <PageHeader
        title="Deadlines"
        description="RFE, NOID, denial, and abeyance-letter deadlines across all active cases."
      />

      <StatStrip
        stats={[
          { label: "Tracked deadlines", value: deadlines.length },
          { label: "Overdue", value: overdue, tone: overdue ? "danger" : "default" },
          { label: "Due this week", value: thisWeek, tone: thisWeek ? "danger" : "default" },
          { label: "RFE / NOID", value: deadlines.filter((d) => d.kind === "RFE" || d.kind === "NOID").length },
        ]}
      />

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Type</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden sm:table-cell">Due date</TableHead>
              <TableHead className="hidden md:table-cell">Legal assistant</TableHead>
              <TableHead className="hidden md:table-cell">Attorney</TableHead>
              <TableHead>Countdown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deadlines.map((d) => (
              <TableRow key={d.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{d.kind}</TableCell>
                <TableCell>
                  <Link href={`/cases/${d.caseId}`} className="hover:underline">
                    {d.clientName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                  {formatDate(d.dueAt)}
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">{staffName(d.laId)}</TableCell>
                <TableCell className="hidden text-sm md:table-cell">{staffName(d.attorneyId)}</TableCell>
                <TableCell>
                  <StatusPill {...deadlineBadge(d)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
