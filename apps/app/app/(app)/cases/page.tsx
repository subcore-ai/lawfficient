import { CasesTable } from "@/components/cases/cases-table"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Cases" }

export default function CasesPage() {
  return (
    <>
      <PageHeader
        title="Cases"
        description="Track retained-client cases through packet preparation, review, and filing."
      />
      <CasesTable />
    </>
  )
}
