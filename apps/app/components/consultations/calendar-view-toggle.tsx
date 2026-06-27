"use client"

import Link from "next/link"
import { CalendarDays, List } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

// List ⇄ Calendar switch. Switching to Calendar drops the attorney/date/type params so the calendar
// opens on its defaults (first attorney, today, first type).
export function CalendarViewToggle({ view }: { view: "list" | "calendar" }) {
  const item = "flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors"
  const active = "bg-background text-foreground shadow-sm"
  return (
    <div className="bg-muted text-muted-foreground mb-4 inline-flex items-center rounded-lg p-1 text-sm">
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
