"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarClock, User, type LucideIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/profile", label: "Account", icon: User },
  { href: "/profile/office-hours", label: "Office hours", icon: CalendarClock },
]

export function ProfileNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 md:w-52 md:shrink-0 md:flex-col md:self-start md:overflow-visible md:pb-0">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/profile" ? pathname === href : pathname.startsWith(href)
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
          </Link>
        )
      })}
    </nav>
  )
}
