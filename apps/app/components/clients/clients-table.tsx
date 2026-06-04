"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { StatStrip } from "@/components/stat-strip"
import { StatusPill } from "@/components/status-pill"
import { staffName } from "@/data"
import { useStore } from "@/data/store"
import { formatCurrency, formatDate } from "@/lib/format"
import { clientStatusBadge, paymentStatusBadge } from "@/lib/status"

export function ClientsTable() {
  const { clients } = useStore()
  const active = clients.filter((c) => c.status === "active" || c.status === "monthly_plan").length
  const monthly = clients.filter((c) => c.status === "monthly_plan").length
  const outstanding = clients.reduce((sum, c) => sum + c.balance, 0)
  const overdue = clients.filter((c) => c.paymentStatus === "overdue").length

  return (
    <div className="flex flex-col gap-4">
      <StatStrip
        stats={[
          { label: "Active clients", value: active },
          { label: "On monthly plans", value: monthly },
          { label: "Outstanding balance", value: formatCurrency(outstanding) },
          { label: "Payments overdue", value: overdue, tone: overdue ? "danger" : "default" },
        ]}
      />

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Case type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden xl:table-cell">Legal assistant</TableHead>
              <TableHead className="hidden lg:table-cell">Hired</TableHead>
              <TableHead className="hidden sm:table-cell">Balance</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="hidden md:table-cell">{c.caseType}</TableCell>
                <TableCell>
                  <StatusPill {...clientStatusBadge(c.status)} />
                </TableCell>
                <TableCell className="hidden xl:table-cell text-sm">{staffName(c.laId)}</TableCell>
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                  {formatDate(c.dateHired)}
                </TableCell>
                <TableCell className="hidden text-sm tabular-nums sm:table-cell">
                  {formatCurrency(c.balance)}
                </TableCell>
                <TableCell>
                  <StatusPill {...paymentStatusBadge(c.paymentStatus)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
