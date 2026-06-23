"use client"

import * as React from "react"
import Link from "next/link"

import { UserAvatar } from "@/components/user-avatar"
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
import { cn } from "@workspace/ui/lib/utils"

import { EditConsultationDialog } from "@/components/consultations/edit-consultation-dialog"
import { EntityRowActions } from "@/components/entity-row-actions"
import { InlineSelect } from "@/components/inline-select"
import { CONSULT_STATUS_OPTIONS } from "@/components/select-field"
import { ShowArchivedToggle } from "@/components/show-archived-toggle"
import { StatStrip } from "@/components/stat-strip"
import { staffName } from "@/data"
import { useStore } from "@/data/store"
import type { ConsultationStatus } from "@/data/types"
import { formatCurrency, formatDateTime } from "@/lib/format"

const FILTERS = [{ value: "all", label: "All statuses" }, ...CONSULT_STATUS_OPTIONS]
const statusLabel = (v: string) => CONSULT_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v

export function ConsultationsTable() {
  const { consultations, updateConsultation } = useStore()
  const [status, setStatus] = React.useState("all")
  const [showArchived, setShowArchived] = React.useState(false)

  const archivedCount = consultations.filter((c) => c.archived).length
  const active = consultations.filter((c) => !c.archived)
  const filtered = consultations
    .filter((c) => (showArchived || !c.archived) && (status === "all" || c.status === status))
    .slice()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  const upcoming = active.filter((c) => ["scheduled", "paid", "rescheduled"].includes(c.status)).length
  const revenue = active.filter((c) => c.paid).reduce((sum, c) => sum + (c.amount ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <StatStrip
        stats={[
          { label: "Upcoming", value: upcoming },
          { label: "Paid", value: active.filter((c) => c.paid).length },
          { label: "Completed", value: active.filter((c) => c.status === "completed").length },
          { label: "Consultation revenue", value: formatCurrency(revenue) },
        ]}
      />

      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")} items={FILTERS}>
          <SelectTrigger className="h-8" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          <ShowArchivedToggle checked={showArchived} onChange={setShowArchived} count={archivedCount} />
          <span className="text-muted-foreground text-xs">{filtered.length} consultations</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Attorney</TableHead>
              <TableHead className="hidden lg:table-cell">When</TableHead>
              <TableHead className="hidden sm:table-cell">Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className={cn("hover:bg-muted/40", c.archived && "opacity-50")}>
                <TableCell>
                  <Link href={`/consultations/${c.id}`} className="font-medium hover:underline">
                    {c.leadName}
                  </Link>
                  <div className="text-muted-foreground text-xs">{c.type}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={staffName(c.attorneyId)} className="size-6" />
                    <span className="text-sm">{staffName(c.attorneyId)}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm lg:table-cell">{formatDateTime(c.startAt)}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {c.paid && c.amount ? (
                    <span className="text-sm tabular-nums">{formatCurrency(c.amount)}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Unpaid</span>
                  )}
                </TableCell>
                <TableCell>
                  <InlineSelect
                    value={c.status}
                    options={CONSULT_STATUS_OPTIONS}
                    ariaLabel="Status"
                    onValueChange={(v) =>
                      updateConsultation(
                        c.id,
                        { status: v as ConsultationStatus, paid: v === "paid" ? true : c.paid },
                        `Status → ${statusLabel(v)}`,
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <EntityRowActions
                    entity="consultation"
                    id={c.id}
                    label={c.leadName}
                    archived={c.archived}
                    editDialog={(p) => <EditConsultationDialog consultation={c} {...p} />}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
