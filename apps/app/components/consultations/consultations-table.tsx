"use client"

import * as React from "react"
import Link from "next/link"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { staffById, staffName } from "@/data"
import { useStore } from "@/data/store"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { consultationStatusBadge } from "@/lib/status"

const STATUSES: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paid", label: "Paid" },
  { value: "completed", label: "Completed" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "canceled", label: "Canceled" },
]

export function ConsultationsTable() {
  const { consultations } = useStore()
  const [status, setStatus] = React.useState("all")

  const filtered = consultations
    .filter((c) => status === "all" || c.status === status)
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  const upcoming = consultations.filter((c) =>
    ["scheduled", "paid", "rescheduled"].includes(c.status),
  ).length
  const revenue = consultations.filter((c) => c.paid).reduce((sum, c) => sum + (c.amount ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <StatStrip
        stats={[
          { label: "Upcoming", value: upcoming },
          { label: "Paid", value: consultations.filter((c) => c.paid).length },
          { label: "Completed", value: consultations.filter((c) => c.status === "completed").length },
          { label: "Consultation revenue", value: formatCurrency(revenue) },
        ]}
      />

      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="h-8" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto text-xs">{filtered.length} consultations</span>
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Attorney</TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="hidden sm:table-cell">Payment</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/40">
                <TableCell>
                  <Link href={`/consultations/${c.id}`} className="font-medium hover:underline">
                    {c.leadName}
                  </Link>
                  <div className="text-muted-foreground text-xs lg:hidden">{c.type}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6 rounded-md">
                      <AvatarFallback className="rounded-md text-[10px]">
                        {staffById(c.attorneyId)?.initials ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{staffName(c.attorneyId)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden lg:table-cell">{c.type}</TableCell>
                <TableCell className="text-sm">{formatDateTime(c.startAt)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {c.paid && c.amount ? (
                    <span className="text-sm tabular-nums">{formatCurrency(c.amount)}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Unpaid</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusPill {...consultationStatusBadge(c.status)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
