"use client"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { EditUserDialog } from "@/components/settings/settings-dialogs"
import { StatusPill, type Tone } from "@/components/status-pill"
import { ROLE_LABELS } from "@/data"
import { useStore } from "@/data/store"
import type { StaffUser } from "@/data/types"

const USER_STATUS: Record<StaffUser["status"], { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invited", tone: "warning" },
  disabled: { label: "Disabled", tone: "neutral" },
}

export function UsersTable() {
  const { staff } = useStore()

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40">
          <TableHead className="pl-4">Name</TableHead>
          <TableHead className="hidden md:table-cell">Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="pr-4 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((u) => (
          <TableRow key={u.id} className="hover:bg-muted/40">
            <TableCell className="pl-4">
              <div className="flex items-center gap-2.5">
                <Avatar className="size-7 rounded-md">
                  <AvatarFallback className="rounded-md text-[10px]">{u.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-muted-foreground text-xs">{u.email}</div>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden text-sm md:table-cell">{ROLE_LABELS[u.role]}</TableCell>
            <TableCell>
              <StatusPill {...USER_STATUS[u.status]} />
            </TableCell>
            <TableCell className="pr-4 text-right">
              <EditUserDialog user={u} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
