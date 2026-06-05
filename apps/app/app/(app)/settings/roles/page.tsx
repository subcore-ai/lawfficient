import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { EditRoleDialog } from "@/components/settings/settings-dialogs"
import { ROLE_LABELS } from "@/data"
import type { Role } from "@/data/types"

export const metadata = { title: "Settings · Roles" }

const ROLE_DESC: Record<Role, string> = {
  admin: "Full access to all features, users, and templates.",
  attorney: "Consultation calendar, notes, packet review, qualification.",
  la_lead: "Owns pod packets; tracks stages and monitors the team.",
  legal_assistant: "Manages packets, documents, onboarding, and updates.",
  qa_lead: "Reviews packets, runs checklists, and monitors sign-offs.",
  creative_writer: "Drafts declarations through the declaration lifecycle.",
  sales: "Enters leads, books consultations, and dispositions calls.",
  accounts_receivable: "Invoices, payments, plans, and collections.",
  file_clerk: "Inbound mail, uploads, and payment status (not amounts).",
}

export default function SettingsRolesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles &amp; permissions</CardTitle>
        <CardDescription>Predefined roles with module-level access</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
          <div key={role} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
              <p className="text-muted-foreground text-xs leading-snug">{ROLE_DESC[role]}</p>
            </div>
            <EditRoleDialog role={role} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
