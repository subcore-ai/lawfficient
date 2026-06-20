"use client"

import * as React from "react"

import { toast } from "@workspace/ui/components/sonner"

import { RowActions } from "@/components/row-actions"
import { hasPermission, useStore, type Permission } from "@/data/store"
import type { AppPermission } from "@/lib/rbac/permissions"
import type { EntityKind } from "@/data/types"

// Each editable/archivable entity maps to its module's edit permission. Editing and
// archiving (a destructive edit) both require it once RBAC is live; the permission
// vocabulary has no separate delete action.
const EDIT_PERMISSION: Partial<Record<EntityKind, AppPermission>> = {
  lead: "leads.edit",
  consultation: "consultations.edit",
  client: "clients.edit",
  case: "cases.edit",
  invoice: "billing.edit",
  document: "documents.edit",
}

/**
 * Row-level actions for any entity: an Edit (opens the supplied controlled dialog) and an
 * Archive/Restore with an Undo toast. Both are gated by the current user's permissions,
 * falling back to the role-based matrix until RBAC enforcement is live.
 */
export function EntityRowActions({
  entity,
  id,
  label,
  archived = false,
  editDialog,
  editPermission = "edit",
  canArchive = true,
}: {
  entity: EntityKind
  id: string
  label: string
  archived?: boolean
  editDialog?: (props: { open: boolean; onOpenChange: (open: boolean) => void }) => React.ReactNode
  editPermission?: Permission
  canArchive?: boolean
}) {
  const { setArchived, currentRole, currentPermissions } = useStore()
  const [editOpen, setEditOpen] = React.useState(false)

  const editApp = EDIT_PERMISSION[entity]
  const allowEdit =
    Boolean(editDialog) && hasPermission(currentPermissions, currentRole, editApp, editPermission)
  const allowArchive =
    canArchive && hasPermission(currentPermissions, currentRole, editApp, "delete")

  return (
    <>
      <RowActions
        canEdit={allowEdit}
        canArchive={allowArchive}
        archived={archived}
        onEdit={allowEdit ? () => setEditOpen(true) : undefined}
        onArchive={
          allowArchive
            ? () => {
                const next = !archived
                setArchived(entity, id, next, label)
                toast.success(next ? "Archived" : "Restored", {
                  description: label,
                  action: next
                    ? { label: "Undo", onClick: () => setArchived(entity, id, false, label) }
                    : undefined,
                })
              }
            : undefined
        }
      />
      {allowEdit && editDialog ? editDialog({ open: editOpen, onOpenChange: setEditOpen }) : null}
    </>
  )
}
