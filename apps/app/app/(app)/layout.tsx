import { redirect } from "next/navigation"

import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { MockStoreProvider } from "@/data/store"
import { getCurrentUser } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/env"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Keep the auth contract consistent: a valid JWT without a profiles row is
  // treated as unauthenticated everywhere (getCurrentUser() returns null), so
  // don't let the app shell load for it. Skipped when Supabase isn't configured
  // so the Phase 0 mock app still renders.
  const me = isSupabaseConfigured() ? await getCurrentUser() : null
  if (isSupabaseConfigured() && !me) {
    redirect("/login")
  }

  return (
    <MockStoreProvider initialRole={me?.role}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppTopbar user={me} />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </MockStoreProvider>
  )
}
