"use client"

import { usePathname, useRouter } from "next/navigation"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type Option = { id: string; name: string }

// Keep in step with MAX_COLUMNS in the consultations page.
const MAX_ATTORNEYS = 6

// Calendar filters / nav: attorney chips (toggle 1–N columns) + the day. Each change rewrites the URL
// searchParams; the server re-loads the day. Date math is plain Y-M-D string arithmetic (no zone needed).
// The consultation type is chosen when booking (in the dialog), not here — slots default to the first type.
export function CalendarControls({
  attorneys,
  attorneyIds,
  date,
  today,
}: {
  attorneys: Option[]
  attorneyIds: string[]
  date: string
  today: string // firm-tz today, for the Today button
}) {
  const router = useRouter()
  const pathname = usePathname()

  function go(next: { attorneys?: string[]; date?: string }) {
    const q = new URLSearchParams()
    q.set("view", "calendar")
    q.set("attorneys", (next.attorneys ?? attorneyIds).join(","))
    q.set("date", next.date ?? date)
    router.push(`${pathname}?${q.toString()}`)
  }

  const atCap = attorneyIds.length >= MAX_ATTORNEYS

  function toggleAttorney(id: string) {
    const has = attorneyIds.includes(id)
    if (has && attorneyIds.length === 1) return // keep at least one column
    if (!has && atCap) return // respect the column cap
    go({ attorneys: has ? attorneyIds.filter((x) => x !== id) : [...attorneyIds, id] })
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
    <div className="space-y-3">
      {attorneys.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {attorneys.map((a) => {
            const on = attorneyIds.includes(a.id)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAttorney(a.id)}
                aria-pressed={on}
                disabled={!on && atCap}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                  on
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40",
                )}
              >
                {on ? <Check className="size-3.5" /> : null}
                {a.name}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => go({ date: shift(-1) })} aria-label="Previous day">
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="default" onClick={() => go({ date: today })} disabled={date === today}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={() => go({ date: shift(1) })} aria-label="Next day">
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-foreground ml-2 inline-block min-w-[9rem] text-sm font-medium">{dateLabel}</span>
      </div>
    </div>
  )
}
