"use client"

import type * as React from "react"
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
} from "@workspace/ui/components/sidebar"

type NavItem = { title: string; href: string; icon: React.ComponentType<{ className?: string }> }

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Clients & Cases",
    items: [
      { title: "Leads", href: "/leads", icon: Users },
      { title: "Consultations", href: "/consultations", icon: CalendarClock },
      { title: "Clients", href: "/clients", icon: UserCheck },
      { title: "Cases", href: "/cases", icon: FolderKanban },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Documents", href: "/documents", icon: FileText },
      { title: "Billing", href: "/billing", icon: Receipt },
      { title: "Communications", href: "/communications", icon: MessageSquare },
    ],
  },
  {
    label: "Insights",
    items: [{ title: "Reporting", href: "/reporting", icon: BarChart3 }],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
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
                <span className="text-muted-foreground text-xs">Immigration LMES</span>
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
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
