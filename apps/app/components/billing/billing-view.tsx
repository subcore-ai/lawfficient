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

import { EditInvoiceDialog } from "@/components/billing/edit-invoice-dialog"
import { SendReminderButton } from "@/components/billing/send-reminder-button"
import { EntityRowActions } from "@/components/entity-row-actions"
import { PAYMENT_TYPE_OPTIONS } from "@/components/select-field"
import { ShowArchivedToggle } from "@/components/show-archived-toggle"
import { StatStrip } from "@/components/stat-strip"
import { StatusPill } from "@/components/status-pill"
import { useStore } from "@/data/store"
import { formatCurrency, formatDate } from "@/lib/format"
import { invoiceStatusBadge } from "@/lib/status"

const typeLabel = (v: string) => PAYMENT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v

export function BillingView() {
  const { invoices } = useStore()
  const [showArchived, setShowArchived] = React.useState(false)

  const active = invoices.filter((i) => !i.archived)
  const archivedCount = invoices.filter((i) => i.archived).length
  const visible = invoices.filter((i) => showArchived || !i.archived)
  const collected = active.reduce((sum, i) => sum + i.paid, 0)
  const outstanding = active.reduce((sum, i) => sum + i.remaining, 0)
  const overdueInvoices = active.filter((i) => i.status === "overdue")
  const overdue = overdueInvoices.reduce((sum, i) => sum + i.remaining, 0)

  return (
    <>
      <StatStrip
        stats={[
          { label: "Collected", value: formatCurrency(collected), tone: "success" },
          { label: "Outstanding", value: formatCurrency(outstanding) },
          { label: "Overdue", value: formatCurrency(overdue), tone: overdue ? "danger" : "default" },
          { label: "Open invoices", value: active.filter((i) => i.status !== "paid").length },
        ]}
      />

      {overdueInvoices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Overdue accounts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {overdueInvoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{i.clientName}</p>
                  <p className="text-muted-foreground text-xs">
                    {i.number} · {i.monthsBehind ?? 1} months behind
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(i.remaining)}</span>
                  <SendReminderButton clientName={i.clientName} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <ShowArchivedToggle checked={showArchived} onChange={setShowArchived} count={archivedCount} />
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Invoice</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead className="hidden sm:table-cell">Total</TableHead>
              <TableHead className="hidden md:table-cell">Remaining</TableHead>
              <TableHead className="hidden lg:table-cell">Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((i) => (
              <TableRow key={i.id} className={cn("hover:bg-muted/40", i.archived && "opacity-50")}>
                <TableCell className="font-medium tabular-nums">{i.number}</TableCell>
                <TableCell>{i.clientName}</TableCell>
                <TableCell className="text-muted-foreground hidden lg:table-cell">{typeLabel(i.type)}</TableCell>
                <TableCell className="hidden text-sm tabular-nums sm:table-cell">{formatCurrency(i.total)}</TableCell>
                <TableCell className="hidden text-sm tabular-nums md:table-cell">{formatCurrency(i.remaining)}</TableCell>
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">{formatDate(i.dueAt)}</TableCell>
                <TableCell>
                  <StatusPill {...invoiceStatusBadge(i.status)} />
                </TableCell>
                <TableCell>
                  <EntityRowActions
                    entity="invoice"
                    id={i.id}
                    label={`${i.number} · ${i.clientName}`}
                    archived={i.archived}
                    editPermission="editFinancial"
                    editDialog={(p) => <EditInvoiceDialog invoice={i} {...p} />}
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
