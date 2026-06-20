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
  DropdownMenuGroup,
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

// Initials from a display name (the real CurrentUser has no `initials` field).
function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

export function AppTopbar({ user }: { user?: { name: string; email: string } | null }) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const { currentRole, setCurrentRole } = useStore()

  // Real signed-in user when Supabase is wired; the mock keeps the Phase 0 demo working.
  const name = user?.name ?? CURRENT_USER.name
  const email = user?.email ?? CURRENT_USER.email
  const initials = user ? initialsOf(user.name) : CURRENT_USER.initials

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
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium lg:inline">{name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-muted-foreground text-xs font-normal">{email}</span>
                  <span className="text-muted-foreground mt-1 text-xs font-normal">
                    Viewing as {ROLE_LABELS[currentRole]}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
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
            <DropdownMenuItem onClick={() => React.startTransition(() => signOut())}>
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
