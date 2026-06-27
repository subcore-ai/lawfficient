"use client"

import { CalendarColumn, PX_PER_MIN } from "@/components/consultations/calendar-column"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import { formatHourLabel, type DayCalendar as DayCalendarData } from "@/lib/scheduling/day-calendar"

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
  columns: { attorney: Option; cal: DayCalendarData }[]
  typeName: string
  leads: Option[]
  attorneys: Option[]
  consultationTypes: ConsultationType[]
  defaultTimeZone: string | null
  canBook: boolean
}) {
  if (columns.length === 0) return null

  const gridStartMin = Math.min(...columns.map((c) => c.cal.gridStartMin))
  const gridEndMin = Math.max(...columns.map((c) => c.cal.gridEndMin))
  const gridHeight = (gridEndMin - gridStartMin) * PX_PER_MIN

  const firstHour = Math.ceil(gridStartMin / 60)
  const lastHour = Math.floor(gridEndMin / 60)
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)

  return (
    <div>
      {/* Per-attorney headers — shown for a single column too, so it's always clear whose calendar this is. */}
      <div className="mb-2 flex pl-12">
        {columns.map((c) => (
          <div key={c.attorney.id} className="text-foreground flex-1 truncate px-1 text-center text-sm font-medium">
            {c.attorney.name}
          </div>
        ))}
      </div>

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
                gridStartMin={gridStartMin}
                attorneyId={c.attorney.id}
                typeName={typeName}
                leads={leads}
                attorneys={attorneys}
                consultationTypes={consultationTypes}
                defaultTimeZone={defaultTimeZone}
                canBook={canBook}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
