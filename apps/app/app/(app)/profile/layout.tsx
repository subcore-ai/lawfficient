import type { ReactNode } from "react"

import { PageHeader } from "@/components/page-header"
import { ProfileNav } from "@/components/profile/profile-nav"

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="My profile" description="Your account details and consultation availability." />
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <ProfileNav />
        <div className="flex min-w-0 max-w-4xl flex-1 flex-col gap-6">{children}</div>
      </div>
    </>
  )
}
