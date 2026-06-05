import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { ConfigureIntegrationDialog } from "@/components/settings/settings-dialogs"
import { StatusPill } from "@/components/status-pill"

export const metadata = { title: "Settings · Integrations" }

const INTEGRATIONS: { name: string; desc: string; status: "connected" | "migrating" }[] = [
  { name: "RingCentral", desc: "Telephony — call tracking & disposition", status: "connected" },
  { name: "MyCase", desc: "Legacy case management — migration source", status: "migrating" },
  { name: "Docketwise", desc: "USCIS form preparation & auto-fill", status: "connected" },
  { name: "Jotforms", desc: "Client intake questionnaires", status: "connected" },
  { name: "Dropbox", desc: "Document storage & per-client folders", status: "connected" },
  { name: "USCIS", desc: "Case status lookup by receipt number", status: "connected" },
]

export default function SettingsIntegrationsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Connected systems and migration status</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
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
  )
}
