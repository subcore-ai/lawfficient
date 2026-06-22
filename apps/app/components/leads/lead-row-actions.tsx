"use client"

import * as React from "react"

import { toast } from "@workspace/ui/components/sonner"

import { setLeadArchived } from "@/app/(app)/leads/actions"
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog"
import { RowActions } from "@/components/row-actions"
import type { AssigneeOption, LeadView } from "@/lib/leads/queries"

// Lead row actions (edit + archive) wired to the server actions — rather than extending the
// shared mock-store EntityRowActions (used by 6 other entities). Renders nothing when the
// caller can't edit, so the menu never appears in read-only/demo mode.
export function LeadRowActions({
  lead,
  assignees,
  canEdit,
}: {
  lead: LeadView
  assignees: AssigneeOption[]
  canEdit: boolean
}) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [, startTransition] = React.useTransition()

  if (!canEdit) return null
  const label = `${lead.firstName} ${lead.lastName}`

  function archive(next: boolean) {
    startTransition(async () => {
      const result = await setLeadArchived(lead.id, next, label)
      if ("error" in result) toast.error(result.error)
    })
  }

  function onArchive() {
    const next = !lead.archived
    archive(next)
    toast.success(next ? "Archived" : "Restored", {
      description: label,
      action: next ? { label: "Undo", onClick: () => archive(false) } : undefined,
    })
  }

  return (
    <>
      <RowActions canEdit archived={lead.archived} onEdit={() => setEditOpen(true)} onArchive={onArchive} />
      <EditLeadDialog lead={lead} assignees={assignees} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}
