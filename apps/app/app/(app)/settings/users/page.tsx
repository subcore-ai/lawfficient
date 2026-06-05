import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { InviteUserDialog } from "@/components/settings/settings-dialogs"
import { UsersTable } from "@/components/settings/users-table"

export const metadata = { title: "Settings · Team" }

export default function SettingsUsersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team members</CardTitle>
        <CardDescription>Manage team access and roles</CardDescription>
        <CardAction>
          <InviteUserDialog />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <UsersTable />
      </CardContent>
    </Card>
  )
}
