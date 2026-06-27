"use client"

import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"

import type { ConsultationType } from "@/lib/consultations/consultation-types"

type Option = { id: string; name: string }

// Attorney + date + type pickers for the calendar. Each change rewrites the URL searchParams; the server
// re-loads the day from the new params. Date math is plain Y-M-D string arithmetic (no zone needed).
export function CalendarControls({
  attorneys,
  attorneyId,
  date,
  today,
  types,
  typeName,
}: {
  attorneys: Option[]
  attorneyId: string
  date: string
  today: string // firm-tz today, for the Today button
  types: ConsultationType[]
  typeName: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  function go(next: { attorney?: string; date?: string; type?: string }) {
    const q = new URLSearchParams()
    q.set("view", "calendar")
    q.set("attorney", next.attorney ?? attorneyId)
    q.set("date", next.date ?? date)
    q.set("type", next.type ?? typeName)
    router.push(`${pathname}?${q.toString()}`)
  }

  function shift(days: number): string {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`))

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <Select
        value={attorneyId}
        onValueChange={(v) => go({ attorney: v ?? attorneyId })}
        items={attorneys.map((a) => ({ value: a.id, label: a.name }))}
      >
        <SelectTrigger className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {attorneys.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => go({ date: shift(-1) })} aria-label="Previous day">
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => go({ date: today })} disabled={date === today}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={() => go({ date: shift(1) })} aria-label="Next day">
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-foreground ml-2 text-sm font-medium">{dateLabel}</span>
      </div>

      <Select
        value={typeName}
        onValueChange={(v) => go({ type: v ?? typeName })}
        items={types.map((t) => ({ value: t.name, label: `${t.name} · ${t.durationMin}m` }))}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t.id} value={t.name}>
              {t.name} · {t.durationMin}m
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
