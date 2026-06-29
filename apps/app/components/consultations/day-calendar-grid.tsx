"use client"

import * as React from "react"
import { Building2 } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { CalendarColumn, PX_PER_MIN } from "@/components/consultations/calendar-column"
import { ConsultPreviewDialog } from "@/components/consultations/consult-preview-dialog"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import type { CalendarColor } from "@/lib/scheduling/calendar-colors"
import { formatHourLabel, type DayCalendar as DayCalendarData, type OffKind } from "@/lib/scheduling/day-calendar"

type Option = { id: string; name: string }

// The day grid: one shared hour gutter + one CalendarColumn per attorney, all aligned to a shared time
// range (union of every column's, so columns line up). One column = the single-attorney view; several =
// the multi-attorney view (Phase 4).
export function DayCalendar({
  columns,
  typeName,
  leads,
  attorneys,
  consultationTypes,
  defaultTimeZone,
  canBook,
}: {
  columns: { attorney: Option; cal: DayCalendarData; off?: OffKind; color?: CalendarColor | null }[]
  typeName: string
  leads: Option[]
  attorneys: Option[]
  consultationTypes: ConsultationType[]
  defaultTimeZone: string | null
  canBook: boolean
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  if (columns.length === 0) return null

  const gridStartMin = Math.min(...columns.map((c) => c.cal.gridStartMin))
  const gridEndMin = Math.max(...columns.map((c) => c.cal.gridEndMin))
  const gridHeight = (gridEndMin - gridStartMin) * PX_PER_MIN

  const firstHour = Math.ceil(gridStartMin / 60)
  const lastHour = Math.floor(gridEndMin / 60)
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)

  // One dialog for the whole grid, keyed by id — the live consult is derived from the columns, so after a
  // reschedule / cancel / delete revalidate it stays in sync (and closes if the consult is gone).
  const selected = columns.flatMap((c) => c.cal.consults).find((c) => c.id === selectedId) ?? null
  // Drop a stale id during render once its consult vanishes (canceled / deleted, or the day changed), so it
  // can't silently reopen the dialog if that consult later reappears (e.g. navigate away + back).
  if (selectedId !== null && selected === null) setSelectedId(null)

  return (
    <div>
      {/* Per-attorney headers — shown for a single column too, so it's always clear whose calendar this is. */}
      <div className="mb-2 flex pl-12">
        {columns.map((c) => (
          <div
            key={c.attorney.id}
            className="text-foreground flex flex-1 items-center justify-center gap-1.5 truncate px-1 text-center text-sm font-medium"
          >
            {c.color ? <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color.solid }} /> : null}
            <span className="truncate">{c.attorney.name}</span>
          </div>
        ))}
      </div>

      {/* All-day row: firm holidays / time off, ABOVE the timed grid and aligned with the columns. */}
      {columns.some((c) => c.off) ? (
        <div className="mb-2 flex pl-12">
          {columns.map((c) => (
            <div key={c.attorney.id} className="min-w-0 flex-1 px-0.5">
              {c.off ? (
                <div
                  className={cn(
                    "flex items-center justify-center gap-1 rounded border px-1.5 py-1 text-center text-[11px] font-medium",
                    c.off === "holiday"
                      ? "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300"
                      : "border-border bg-muted/60 text-muted-foreground",
                  )}
                >
                  {c.off === "holiday" ? (
                    <>
                      <Building2 className="size-3 shrink-0" />
                      Company holiday
                    </>
                  ) : (
                    "Time off"
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative" style={{ height: gridHeight }}>
        {/* Hour lines span the full width; labels sit in the left gutter. */}
        {hours.map((h) => (
          <div
            key={h}
            className="border-border/60 absolute inset-x-0 border-t"
            style={{ top: (h * 60 - gridStartMin) * PX_PER_MIN }}
          >
            <span className="text-muted-foreground absolute -top-2 left-0 w-11 text-right text-[10px]">{formatHourLabel(h)}</span>
          </div>
        ))}

        {/* Attorney columns, right of the label gutter. */}
        <div className="absolute inset-y-0 left-12 right-0 flex">
          {columns.map((c) => (
            <div key={c.attorney.id} className="border-border/50 relative flex-1 border-l first:border-l-0">
              <CalendarColumn
                windows={c.cal.windows}
                consults={c.cal.consults}
                slots={c.cal.slots}
                color={c.color}
                gridStartMin={gridStartMin}
                attorneyId={c.attorney.id}
                typeName={typeName}
                leads={leads}
                attorneys={attorneys}
                consultationTypes={consultationTypes}
                defaultTimeZone={defaultTimeZone}
                canBook={canBook}
                onSelectConsult={(consult) => setSelectedId(consult.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <ConsultPreviewDialog
        consult={selected}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null)
        }}
        canManage={canBook}
      />
    </div>
  )
}
