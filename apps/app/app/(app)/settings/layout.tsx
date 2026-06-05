import type { ReactNode } from "react"

import { PageHeader } from "@/components/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Firm configuration — team, roles, templates, pipeline, and integrations."
      />
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <SettingsNav />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </>
  )
}
