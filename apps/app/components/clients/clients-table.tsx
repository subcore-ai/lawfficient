"use client"

import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { EditClientDialog } from "@/components/clients/edit-client-dialog"
import { EntityRowActions } from "@/components/entity-row-actions"
import { InlineSelect } from "@/components/inline-select"
import { CLIENT_STATUS_OPTIONS } from "@/components/select-field"
import { ShowArchivedToggle } from "@/components/show-archived-toggle"
import { StatStrip } from "@/components/stat-strip"
import { StatusPill } from "@/components/status-pill"
import { staffName } from "@/data"
import { useStore } from "@/data/store"
import type { ClientStatus } from "@/data/types"
import { formatCurrency, formatDate } from "@/lib/format"
import { paymentStatusBadge } from "@/lib/status"

const statusLabel = (v: string) => CLIENT_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v

export function ClientsTable() {
  const { clients, updateClient } = useStore()
  const [showArchived, setShowArchived] = React.useState(false)

  const archivedCount = clients.filter((c) => c.archived).length
  const visible = clients.filter((c) => showArchived || !c.archived)
  const active = clients.filter((c) => !c.archived)
  const activeCount = active.filter((c) => c.status === "active" || c.status === "monthly_plan").length
  const monthly = active.filter((c) => c.status === "monthly_plan").length
  const outstanding = active.reduce((sum, c) => sum + c.balance, 0)
  const overdue = active.filter((c) => c.paymentStatus === "overdue").length

  return (
    <div className="flex flex-col gap-4">
      <StatStrip
        stats={[
          { label: "Active clients", value: activeCount },
          { label: "On monthly plans", value: monthly },
          { label: "Outstanding balance", value: formatCurrency(outstanding) },
          { label: "Payments overdue", value: overdue, tone: overdue ? "danger" : "default" },
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
              <TableHead className="hidden md:table-cell">Case type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden xl:table-cell">Legal assistant</TableHead>
              <TableHead className="hidden lg:table-cell">Hired</TableHead>
              <TableHead className="hidden sm:table-cell">Balance</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((c) => (
              <TableRow key={c.id} className={cn("hover:bg-muted/40", c.archived && "opacity-50")}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="hidden md:table-cell">{c.caseType}</TableCell>
                <TableCell>
                  <InlineSelect
                    value={c.status}
                    options={CLIENT_STATUS_OPTIONS}
                    ariaLabel="Status"
                    onValueChange={(v) =>
                      updateClient(c.id, { status: v as ClientStatus }, `Status → ${statusLabel(v)}`)
                    }
                  />
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
                <TableCell>
                  <EntityRowActions
                    entity="client"
                    id={c.id}
                    label={c.name}
                    archived={c.archived}
                    editDialog={(p) => <EditClientDialog client={c} {...p} />}
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
