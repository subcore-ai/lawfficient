"use client"

import { Archive, ArchiveRestore, EllipsisVertical, Pencil } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

export function RowActions({
  onEdit,
  onArchive,
  archived = false,
  canEdit = true,
  canArchive = true,
}: {
  onEdit?: () => void
  onArchive?: () => void
  archived?: boolean
  canEdit?: boolean
  canArchive?: boolean
}) {
  if (!canEdit && !canArchive) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
        <EllipsisVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {canEdit && onEdit ? (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
        ) : null}
        {canArchive && onArchive ? (
          <>
            {canEdit && onEdit ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              onClick={onArchive}
              className={cn(!archived && "text-destructive")}
            >
              {archived ? (
                <>
                  <ArchiveRestore className="size-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="size-4" /> Archive
                </>
              )}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
