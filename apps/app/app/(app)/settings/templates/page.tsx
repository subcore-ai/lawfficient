import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { ManageTemplateDialog } from "@/components/settings/settings-dialogs"

export const metadata = { title: "Settings · Templates" }

const TEMPLATES = [
  { name: "Quote letters", desc: "PDF quote-letter templates by case type." },
  { name: "Engagement agreements", desc: "One- and two-signer templates with conditional scope." },
]

export default function SettingsTemplatesPage() {
  return (
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
  )
}
