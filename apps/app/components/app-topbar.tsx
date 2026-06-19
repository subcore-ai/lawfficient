"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Eye, LogOut, Search, Settings, User } from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"

import { ThemeToggle } from "@/components/theme-toggle"
import { signOut } from "@/app/(auth)/actions"
import { CURRENT_USER, ROLE_LABELS } from "@/data"
import { useStore } from "@/data/store"
import type { Role } from "@/data/types"

const ROLES = Object.keys(ROLE_LABELS) as Role[]

const SEGMENT_LABELS: Record<string, string> = {
  leads: "Leads",
  consultations: "Consultations",
  clients: "Clients",
  cases: "Cases",
  deadlines: "Deadlines",
  documents: "Documents",
  billing: "Billing",
  invoices: "Invoices",
  overdue: "Overdue",
  monthly: "Monthly clients",
  reports: "Reports",
  communications: "Communications",
  reporting: "Reporting",
  settings: "Settings",
  users: "Users",
  roles: "Roles",
  templates: "Templates",
  integrations: "Integrations",
}

function labelFor(segment: string) {
  return SEGMENT_LABELS[segment] ?? "Details"
}

export function AppTopbar() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const { currentRole, setCurrentRole } = useStore()

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {segments.length === 0 ? (
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            ) : (
              <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {segments.map((segment, i) => {
            const href = `/${segments.slice(0, i + 1).join("/")}`
            const isLast = i === segments.length - 1
            return (
              <React.Fragment key={href}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{labelFor(segment)}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={href} />}>{labelFor(segment)}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative hidden md:block">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Search leads, clients, cases…"
            className="h-9 w-64 pl-8"
            aria-label="Search"
          />
        </div>

        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          <span className="bg-destructive absolute top-1.5 right-1.5 size-1.5 rounded-full" />
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account" />}
          >
            <Avatar className="size-7 rounded-md">
              <AvatarFallback className="bg-primary text-primary-foreground rounded-md text-xs">
                {CURRENT_USER.initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium lg:inline">{CURRENT_USER.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{CURRENT_USER.name}</span>
                <span className="text-muted-foreground text-xs font-normal">{CURRENT_USER.email}</span>
                <span className="text-muted-foreground mt-1 text-xs font-normal">
                  Viewing as {ROLE_LABELS[currentRole]}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Eye className="size-4" /> View as role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={currentRole}
                  onValueChange={(v) => setCurrentRole((v ?? currentRole) as Role)}
                >
                  {ROLES.map((r) => (
                    <DropdownMenuRadioItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="size-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="size-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem render={<button type="submit" className="w-full" />}>
                <LogOut className="size-4" /> Log out
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
