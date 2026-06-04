"use client"

import * as React from "react"

import { toast } from "@workspace/ui/components/sonner"

import { RowActions } from "@/components/row-actions"
import { can, useStore, type Permission } from "@/data/store"
import type { EntityKind } from "@/data/types"

/**
 * Row-level actions for any entity: an Edit (opens the supplied controlled dialog) and an
 * Archive/Restore with an Undo toast. Both are gated by the current role via can().
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
  const { setArchived, currentRole } = useStore()
  const [editOpen, setEditOpen] = React.useState(false)

  const allowEdit = Boolean(editDialog) && can(currentRole, editPermission)
  const allowArchive = canArchive && can(currentRole, "delete")

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
