"use client"

import * as React from "react"
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { Building2 } from "lucide-react"

import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { rescheduleConsultation } from "@/app/(app)/consultations/actions"
import { CalendarColumn, PX_PER_MIN } from "@/components/consultations/calendar-column"
import { ConsultPreviewDialog } from "@/components/consultations/consult-preview-dialog"
import type { OffDateRange } from "@/lib/availability/exceptions"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import { zonedWallTimeToUtcISO } from "@/lib/consultations/time"
import type { CalendarColor } from "@/lib/scheduling/calendar-colors"
import { draggedStartMin, formatHourLabel, minToHhmm, type DayCalendar as DayCalendarData, type OffKind } from "@/lib/scheduling/day-calendar"

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
  offDatesByAttorney,
  date,
  nowMin,
  isPastDay,
}: {
  columns: { attorney: Option; cal: DayCalendarData; off?: OffKind[]; color?: CalendarColor | null }[]
  typeName: string
  leads: Option[]
  attorneys: Option[]
  consultationTypes: ConsultationType[]
  defaultTimeZone: string | null
  canBook: boolean
  // Upcoming off-dates per attorney (own time off + firm holidays) for the booking/reschedule pickers.
  offDatesByAttorney: Record<string, OffDateRange[]>
  // The viewed day (YYYY-MM-DD), for computing a dragged consult's new start instant.
  date: string
  // Firm-tz minute-of-day of "now" when the viewed day IS today (else null/undefined); a past date sets
  // isPastDay. Used to dim the elapsed part of the grid + draw the "now" hairline.
  nowMin?: number | null
  isPastDay?: boolean
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  // Drag-to-reschedule state + sensors — declared before the early return so the hooks always run.
  const [pending, setPending] = React.useState<{ id: string; startMin: number } | null>(null)
  const [lastColumns, setLastColumns] = React.useState(columns)
  // Small activation distance so a plain click still opens the detail dialog (only a real drag moves it).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  if (columns.length === 0) return null

  const gridStartMin = Math.min(...columns.map((c) => c.cal.gridStartMin))
  const gridEndMin = Math.max(...columns.map((c) => c.cal.gridEndMin))
  const gridHeight = (gridEndMin - gridStartMin) * PX_PER_MIN

  // Dim the elapsed part of the grid so shaded office hours that are already past don't read as bookable:
  // the whole day for a past date, up to "now" for today (with a hairline at "now"). nowMin is null unless
  // the viewed day is today.
  const pastBoundaryMin = isPastDay ? gridEndMin : typeof nowMin === "number" ? Math.min(nowMin, gridEndMin) : gridStartMin
  const showNowLine = !isPastDay && typeof nowMin === "number" && nowMin >= gridStartMin && nowMin <= gridEndMin

  const firstHour = Math.ceil(gridStartMin / 60)
  const lastHour = Math.floor(gridEndMin / 60)
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)

  // Drag-to-reschedule. Optimistically move the dragged consult to its new start-minute while the server
  // write is in flight; on failure revert + toast. A successful write revalidates → new `columns` arrive →
  // the reconcile drops the optimistic move (the block is already at the server position).
  const tz = defaultTimeZone ?? "America/New_York"
  if (lastColumns !== columns) {
    setLastColumns(columns)
    setPending(null)
  }
  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id)
    const consult = columns.flatMap((c) => c.cal.consults).find((x) => x.id === id)
    if (!consult) return
    const newStartMin = draggedStartMin(consult.startMin, e.delta.y, PX_PER_MIN)
    if (newStartMin === consult.startMin) return // no real move (or snapped back to where it started)
    const startAt = zonedWallTimeToUtcISO(`${date}T${minToHhmm(newStartMin)}`, tz)
    if (!startAt) return
    setPending({ id, startMin: newStartMin })
    void rescheduleConsultation(id, startAt).then((res) => {
      if (res && "error" in res) {
        toast.error(res.error)
        setPending(null) // spring back
      }
    })
  }

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
      {columns.some((c) => c.off && c.off.length > 0) ? (
        <div className="mb-2 flex pl-12">
          {columns.map((c) => (
            <div key={c.attorney.id} className="flex min-w-0 flex-1 flex-col gap-0.5 px-0.5">
              {(c.off ?? []).map((kind) => (
                <div
                  key={kind}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded border px-1.5 py-1 text-center text-[11px] font-medium",
                    kind === "holiday"
                      ? "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300"
                      : "border-border bg-muted/60 text-muted-foreground",
                  )}
                >
                  {kind === "holiday" ? (
                    <>
                      <Building2 className="size-3 shrink-0" />
                      Company holiday
                    </>
                  ) : (
                    "Time off"
                  )}
                </div>
              ))}
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

        {/* Attorney columns. Wrapped in a DndContext so a consult block can be dragged vertically to
            reschedule (restrictToVerticalAxis); the column renders the optimistic move from `pending`. */}
        <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
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
                  offDatesByAttorney={offDatesByAttorney}
                  pendingMove={pending}
                  onSelectConsult={(consult) => setSelectedId(consult.id)}
                />
              </div>
            ))}
          </div>
        </DndContext>

        {/* Elapsed-time shading + "now" hairline (today / past days only). pointer-events-none so the
            future slots below stay clickable, and any past consult under it stays clickable too. */}
        {pastBoundaryMin > gridStartMin ? (
          <div
            className="bg-background/60 pointer-events-none absolute left-12 right-0 top-0"
            style={{ height: (pastBoundaryMin - gridStartMin) * PX_PER_MIN }}
          />
        ) : null}
        {showNowLine ? (
          <div
            className="bg-primary pointer-events-none absolute left-12 right-0 h-px"
            style={{ top: (nowMin! - gridStartMin) * PX_PER_MIN }}
          >
            {/* Dot on the left edge so the line reads as "now", not just another hour line. */}
            <div className="bg-primary absolute -left-1 -top-1 size-2 rounded-full" />
          </div>
        ) : null}
      </div>

      <ConsultPreviewDialog
        consult={selected}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null)
        }}
        canManage={canBook}
        offDatesByAttorney={offDatesByAttorney}
      />
    </div>
  )
}
