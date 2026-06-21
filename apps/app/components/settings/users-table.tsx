import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  UserRowActions,
  type ManagedUser,
  type RoleOption,
} from "@/components/settings/settings-dialogs"
import { StatusPill, type Tone } from "@/components/status-pill"
import { ROLE_LABELS } from "@/data"
import type { StaffUser } from "@/data/types"

const USER_STATUS: Record<StaffUser["status"], { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invited", tone: "warning" },
  disabled: { label: "Disabled", tone: "neutral" },
}

export function UsersTable({
  users,
  currentUserId,
  canManage,
  canManageRoles,
  roles,
}: {
  users: ManagedUser[]
  currentUserId: string
  canManage: boolean
  canManageRoles: boolean
  roles: RoleOption[]
}) {
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
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
              No team members yet.
            </TableCell>
          </TableRow>
        ) : (
          users.map((u) => (
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
              <TableCell className="hidden text-sm md:table-cell">
                {ROLE_LABELS[u.role]}
                {u.roleIds.length > 1 ? (
                  <span className="text-muted-foreground"> +{u.roleIds.length - 1}</span>
                ) : null}
              </TableCell>
              <TableCell>
                <StatusPill {...USER_STATUS[u.status]} />
              </TableCell>
              <TableCell className="pr-4 text-right">
                {canManage ? (
                  <UserRowActions
                  user={u}
                  currentUserId={currentUserId}
                  canManageRoles={canManageRoles}
                  roles={roles}
                />
                ) : null}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
