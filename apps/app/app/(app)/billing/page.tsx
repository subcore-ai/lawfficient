import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { RevenueReportDialog } from "@/components/billing/revenue-report-dialog"
import { SendReminderButton } from "@/components/billing/send-reminder-button"
import { PageHeader } from "@/components/page-header"
import { StatStrip } from "@/components/stat-strip"
import { StatusPill } from "@/components/status-pill"
import { INVOICES } from "@/data"
import type { PaymentType } from "@/data/types"
import { formatCurrency, formatDate } from "@/lib/format"
import { invoiceStatusBadge } from "@/lib/status"

export const metadata = { title: "Billing" }

const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  monthly: "Monthly",
  down_payment: "Down payment",
  full_payment: "Full payment",
  partial_down: "Partial down",
  consultation: "Consultation",
  filing_fee: "Filing fee",
}

export default function BillingPage() {
  const collected = INVOICES.reduce((sum, i) => sum + i.paid, 0)
  const outstanding = INVOICES.reduce((sum, i) => sum + i.remaining, 0)
  const overdueInvoices = INVOICES.filter((i) => i.status === "overdue")
  const overdue = overdueInvoices.reduce((sum, i) => sum + i.remaining, 0)

  return (
    <>
      <PageHeader title="Billing & Payments" description="Invoices, payments, and collections.">
        <RevenueReportDialog />
      </PageHeader>

      <StatStrip
        stats={[
          { label: "Collected", value: formatCurrency(collected), tone: "success" },
          { label: "Outstanding", value: formatCurrency(outstanding) },
          { label: "Overdue", value: formatCurrency(overdue), tone: overdue ? "danger" : "default" },
          { label: "Open invoices", value: INVOICES.filter((i) => i.status !== "paid").length },
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {INVOICES.map((i) => (
              <TableRow key={i.id} className="hover:bg-muted/40">
                <TableCell className="font-medium tabular-nums">{i.number}</TableCell>
                <TableCell>{i.clientName}</TableCell>
                <TableCell className="text-muted-foreground hidden lg:table-cell">
                  {PAYMENT_TYPE_LABEL[i.type]}
                </TableCell>
                <TableCell className="hidden text-sm tabular-nums sm:table-cell">
                  {formatCurrency(i.total)}
                </TableCell>
                <TableCell className="hidden text-sm tabular-nums md:table-cell">
                  {formatCurrency(i.remaining)}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                  {formatDate(i.dueAt)}
                </TableCell>
                <TableCell>
                  <StatusPill {...invoiceStatusBadge(i.status)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
