import { ClientsTable } from "@/components/clients/clients-table"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Clients" }

export default function ClientsPage() {
  return (
    <>
      <PageHeader title="Clients" description="Retained clients, their cases, and balances." />
      <ClientsTable />
    </>
  )
}
