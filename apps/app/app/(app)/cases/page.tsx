import Link from "next/link"
import { CalendarClock, Printer } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { CasesTable } from "@/components/cases/cases-table"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Cases" }

export default function CasesPage() {
  return (
    <>
      <PageHeader
        title="Cases"
        description="Track retained-client cases through packet preparation, review, and filing."
      >
        <Button variant="outline" size="sm" render={<Link href="/cases/deadlines" />}>
          <CalendarClock className="size-4" /> Deadlines
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/cases/printing" />}>
          <Printer className="size-4" /> Printing queue
        </Button>
      </PageHeader>
      <CasesTable />
    </>
  )
}
