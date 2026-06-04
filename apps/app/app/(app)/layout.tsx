import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { MockStoreProvider } from "@/data/store"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MockStoreProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppTopbar />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </MockStoreProvider>
  )
}
