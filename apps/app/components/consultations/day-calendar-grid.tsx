"use client"

import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import type { DayCalendar } from "@/lib/scheduling/day-calendar"

type Option = { id: string; name: string }

const PX_PER_MIN = 0.9

function fmtTime(min: number): string {
  const h24 = Math.floor(min / 60)
  const m = min % 60
  const ampm = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}
function fmtHour(h24: number): string {
  const ampm = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12} ${ampm}`
}

// One attorney's day, as a vertical time grid: office hours shaded, booked consults as blocks, and free
// slots as click-to-book buttons (prefilled with this attorney + start + the selected type). Reused per
// column by the multi-attorney view. Positions everything by firm-tz minutes-of-day (built server-side).
export function DayCalendarGrid({
  cal,
  attorneyId,
  typeName,
  leads,
  attorneys,
  consultationTypes,
  defaultTimeZone,
  canBook,
}: {
  cal: DayCalendar
  attorneyId: string
  typeName: string
  leads: Option[]
  attorneys: Option[]
  consultationTypes: ConsultationType[]
  defaultTimeZone: string | null
  canBook: boolean
}) {
  const top = (min: number) => (min - cal.gridStartMin) * PX_PER_MIN
  const height = (mins: number) => Math.max(mins * PX_PER_MIN, 16)
  const gridHeight = (cal.gridEndMin - cal.gridStartMin) * PX_PER_MIN

  const firstHour = Math.ceil(cal.gridStartMin / 60)
  const lastHour = Math.floor(cal.gridEndMin / 60)
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)

  return (
    <div className="relative" style={{ height: gridHeight }}>
      {/* Hour lines + labels in a left gutter. */}
      {hours.map((h) => (
        <div
          key={h}
          className="border-border/60 absolute inset-x-0 border-t"
          style={{ top: top(h * 60) }}
        >
          <span className="text-muted-foreground absolute -top-2 left-0 w-11 text-right text-[10px]">
            {fmtHour(h)}
          </span>
        </div>
      ))}

      {/* Content column, right of the label gutter. */}
      <div className="absolute inset-y-0 left-12 right-1">
        {/* Office hours shading. */}
        {cal.windows.map((w, i) => (
          <div
            key={`w-${i}`}
            className="bg-muted/50 absolute inset-x-0 rounded"
            style={{ top: top(w.startMin), height: height(w.endMin - w.startMin) }}
          />
        ))}

        {/* Free slots — click to book. */}
        {cal.slots.map((s) => {
          const style = { top: top(s.startMin), height: height(s.endMin - s.startMin) }
          const label = fmtTime(s.startMin)
          if (!canBook) {
            return (
              <div
                key={s.startMs}
                className="border-primary/40 text-primary/70 absolute inset-x-0 overflow-hidden rounded border border-dashed px-1.5 text-[11px] leading-tight"
                style={style}
              >
                {label}
              </div>
            )
          }
          return (
            <BookConsultationDialog
              key={s.startMs}
              leads={leads}
              attorneys={attorneys}
              consultationTypes={consultationTypes}
              defaultTimeZone={defaultTimeZone}
              prefillStart={s.startInput}
              prefillAttorneyId={attorneyId}
              prefillType={typeName}
              trigger={
                <button
                  type="button"
                  aria-label={`Book ${label}`}
                  className="border-primary/40 text-primary hover:bg-primary/10 absolute inset-x-0 cursor-pointer overflow-hidden rounded border border-dashed px-1.5 text-left text-[11px] leading-tight transition-colors"
                  style={style}
                >
                  {label}
                </button>
              }
            />
          )
        })}

        {/* Booked consults — drawn over slots/shading. */}
        {cal.consults.map((c) => (
          <div
            key={c.id}
            title={`${c.leadName} · ${c.type} · ${fmtTime(c.startMin)}`}
            className="bg-primary/85 text-primary-foreground absolute inset-x-0 overflow-hidden rounded px-1.5 py-0.5 text-[11px] leading-tight shadow-sm"
            style={{ top: top(c.startMin), height: height(c.endMin - c.startMin) }}
          >
            <span className="block truncate font-medium">{c.leadName}</span>
            <span className="block truncate opacity-80">{c.type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
