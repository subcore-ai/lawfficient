"use client"

import Link from "next/link"
import { CalendarDays, List } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

// List ⇄ Calendar switch. Switching to Calendar drops the attorney/date/type params so the calendar
// opens on its defaults (first attorney, today, first type).
export function CalendarViewToggle({ view }: { view: "list" | "calendar" }) {
  // Mirrors the shared Tabs look (baseline border under the row, active item a subtle rounded pill). It's a
  // URL nav (Links), not the in-page Tabs component, so it matches the style rather than reusing it.
  const item =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
  const active = "bg-muted text-foreground"
  return (
    <div className="border-border mb-4 flex h-10 w-full items-center gap-1 border-b">
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
