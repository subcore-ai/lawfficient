import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"

import { Field } from "@/components/form-field"
import { ToastButton } from "@/components/toast-button"

export const metadata = { title: "Settings · General" }

export default function SettingsGeneralPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Firm profile</CardTitle>
        <CardDescription>Your firm&apos;s name, contact details, and defaults.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Firm name">
            <Input defaultValue="Chidolu Law Firm" />
          </Field>
          <Field label="Contact email">
            <Input type="email" defaultValue="office@chidolulaw.com" />
          </Field>
          <Field label="Phone">
            <Input type="tel" defaultValue="(305) 555-0100" />
          </Field>
          <Field label="Default time zone">
            <Input defaultValue="Eastern (ET)" />
          </Field>
          <Field label="Default language">
            <Input defaultValue="English" />
          </Field>
          <Field label="Default consultation fee">
            <Input defaultValue="$150" />
          </Field>
          <Field label="Office address" className="sm:col-span-2">
            <Input defaultValue="123 Biscayne Blvd, Suite 400, Miami, FL 33131" />
          </Field>
        </div>
        <ToastButton className="w-fit" message="Firm profile saved" description="Changes are live for the team.">
          Save changes
        </ToastButton>
      </CardContent>
    </Card>
  )
}
