"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  FileText,
  ListChecks,
  Plug,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { DataStatusDot } from "@/components/dev/data-status-dot"
import { type DataStatus } from "@/lib/dev/data-status"

// `data` is the build-time wiring status (see lib/dev/data-status.ts) — flip to "live" as a tab is
// wired. General/Templates/Pipeline are still mock; users/roles/taxonomies/integrations are live.
const ITEMS: {
  href: string
  label: string
  icon: LucideIcon
  data: DataStatus
}[] = [
  { href: "/settings", label: "General", icon: Building2, data: "mock" },
  { href: "/settings/users", label: "Team members", icon: Users, data: "live" },
  { href: "/settings/roles", label: "Roles & permissions", icon: ShieldCheck, data: "live" },
  { href: "/settings/taxonomies", label: "Case taxonomies", icon: Tags, data: "live" },
  { href: "/settings/templates", label: "Templates", icon: FileText, data: "mock" },
  { href: "/settings/pipeline", label: "Packet pipeline", icon: ListChecks, data: "mock" },
  { href: "/settings/integrations", label: "Integrations", icon: Plug, data: "live" },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 md:w-52 md:shrink-0 md:flex-col md:self-start md:overflow-visible md:pb-0">
      {ITEMS.map(({ href, label, icon: Icon, data }) => {
        const active = href === "/settings" ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
            <DataStatusDot status={data} className="ml-auto" />
          </Link>
        )
      })}
    </nav>
  )
}
