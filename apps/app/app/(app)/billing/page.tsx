import { BillingView } from "@/components/billing/billing-view"
import { RevenueReportDialog } from "@/components/billing/revenue-report-dialog"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Billing" }

export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing & Payments" description="Invoices, payments, and collections.">
        <RevenueReportDialog />
      </PageHeader>
      <BillingView />
    </>
  )
}
