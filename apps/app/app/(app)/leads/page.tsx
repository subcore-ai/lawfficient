import { PageHeader } from "@/components/page-header"
import { ImportLeadsDialog } from "@/components/leads/import-leads-dialog"
import { LeadsTable } from "@/components/leads/leads-table"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"

export const metadata = { title: "Leads" }

export default function LeadsPage() {
  return (
    <>
      <PageHeader
        title="Leads"
        description="Capture, qualify, and track leads through the conversion pipeline."
      >
        <ImportLeadsDialog />
        <NewLeadDialog />
      </PageHeader>

      <LeadsTable />
    </>
  )
}
