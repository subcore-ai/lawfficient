"use client"

import Link from "next/link"
import { CalendarDays, List } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

// List ⇄ Calendar switch. Switching to Calendar drops the attorney/date/type params so the calendar
// opens on its defaults (first attorney, today, first type).
export function CalendarViewToggle({ view }: { view: "list" | "calendar" }) {
  // Mirrors the shared Tabs look: a bordered tray with the active item a raised filled tile. It's a URL nav
  // (Links), not the in-page Tabs component, so it matches the style rather than reusing it.
  const item =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
  const active = "bg-muted text-foreground shadow-sm"
  return (
    <div className="border-border bg-muted/40 mb-4 inline-flex items-center gap-1 rounded-lg border p-1">
      <Link
        href="/consultations?view=list"
        aria-current={view === "list" ? "page" : undefined}
        className={cn(item, view === "list" && active)}
      >
        <List className="size-4" /> List
      </Link>
      <Link
        href="/consultations?view=calendar"
        aria-current={view === "calendar" ? "page" : undefined}
        className={cn(item, view === "calendar" && active)}
      >
        <CalendarDays className="size-4" /> Calendar
      </Link>
    </div>
  )
}
