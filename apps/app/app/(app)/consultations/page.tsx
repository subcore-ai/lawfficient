import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import { ConsultationsTable } from "@/components/consultations/consultations-table"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Consultations" }

export default function ConsultationsPage() {
  return (
    <>
      <PageHeader
        title="Consultations"
        description="Book, pay for, and manage consultations across attorney calendars."
      >
        <BookConsultationDialog />
      </PageHeader>

      <ConsultationsTable />
    </>
  )
}
