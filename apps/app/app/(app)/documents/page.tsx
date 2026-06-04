import { DocumentsView } from "@/components/documents/documents-view"
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Documents" }

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Inbound mail, client uploads, and per-case submission tracking."
      >
        <UploadDocumentDialog triggerLabel="Upload" triggerVariant="default" />
      </PageHeader>

      <DocumentsView />
    </>
  )
}
