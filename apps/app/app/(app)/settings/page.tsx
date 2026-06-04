import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { PageHeader } from "@/components/page-header"
import {
  ConfigureIntegrationDialog,
  EditRoleDialog,
  InviteUserDialog,
  ManageTemplateDialog,
} from "@/components/settings/settings-dialogs"
import { UsersTable } from "@/components/settings/users-table"
import { StatusPill } from "@/components/status-pill"
import { ROLE_LABELS } from "@/data"
import type { Role } from "@/data/types"

export const metadata = { title: "Settings" }

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

const INTEGRATIONS: { name: string; desc: string; status: "connected" | "migrating" }[] = [
  { name: "RingCentral", desc: "Telephony — call tracking & disposition", status: "connected" },
  { name: "MyCase", desc: "Legacy case management — migration source", status: "migrating" },
  { name: "Docketwise", desc: "USCIS form preparation & auto-fill", status: "connected" },
  { name: "Jotforms", desc: "Client intake questionnaires", status: "connected" },
  { name: "Dropbox", desc: "Document storage & per-client folders", status: "connected" },
  { name: "USCIS", desc: "Case status lookup by receipt number", status: "connected" },
]

const TEMPLATES = [
  { name: "Quote letters", desc: "PDF quote-letter templates by case type." },
  { name: "Engagement agreements", desc: "One- and two-signer templates with conditional scope." },
]

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Users, roles, templates, and integrations.">
        <InviteUserDialog />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>Manage team access and roles</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <UsersTable />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Quote letters and engagement agreements</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {TEMPLATES.map((t) => (
              <div key={t.name} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-muted-foreground text-xs leading-snug">{t.desc}</p>
                </div>
                <ManageTemplateDialog name={t.name} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connected systems and migration status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((it) => (
            <div key={it.name} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{it.name}</p>
                <StatusPill
                  label={it.status === "connected" ? "Connected" : "Migrating"}
                  tone={it.status === "connected" ? "success" : "warning"}
                  dot
                />
              </div>
              <p className="text-muted-foreground text-xs leading-snug">{it.desc}</p>
              <ConfigureIntegrationDialog name={it.name} />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
