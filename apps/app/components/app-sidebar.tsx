"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  CalendarClock,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Scale,
  Settings,
  UserCheck,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import { DataStatusDot } from "@/components/dev/data-status-dot"
import {
  DATA_STATUS_LABEL,
  SHOW_DATA_STATUS,
  type DataStatus,
} from "@/lib/dev/data-status"

type NavItem = {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  // Build-time data-wiring status (see lib/dev/data-status.ts). Flip to "live" as a section is wired.
  data: DataStatus
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard, data: "partial" }],
  },
  {
    label: "Clients & Cases",
    items: [
      { title: "Leads", href: "/leads", icon: Users, data: "live" },
      { title: "Consultations", href: "/consultations", icon: CalendarClock, data: "mock" },
      { title: "Clients", href: "/clients", icon: UserCheck, data: "mock" },
      { title: "Cases", href: "/cases", icon: FolderKanban, data: "mock" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Documents", href: "/documents", icon: FileText, data: "mock" },
      { title: "Billing", href: "/billing", icon: Receipt, data: "mock" },
      { title: "Communications", href: "/communications", icon: MessageSquare, data: "mock" },
    ],
  },
  {
    label: "Insights",
    items: [{ title: "Reporting", href: "/reporting", icon: BarChart3, data: "mock" }],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  // Close the mobile sidebar sheet after navigating to a new page.
  React.useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Lawfficient" render={<Link href="/" />}>
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Scale className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Lawfficient</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                    <DataStatusDot status={item.data} className="ml-auto" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive("/settings")}
              tooltip="Settings"
              render={<Link href="/settings" />}
            >
              <Settings className="size-4" />
              <span>Settings</span>
              <DataStatusDot status="partial" className="ml-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {SHOW_DATA_STATUS ? (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-2 py-1 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
            {(["live", "partial", "mock"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <DataStatusDot status={s} />
                {DATA_STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
