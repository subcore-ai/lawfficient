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
import { draggedStartMin, formatHourLabel, formatSlotTime, minToHhmm, type DayCalendar as DayCalendarData, type OffKind } from "@/lib/scheduling/day-calendar"

type Option = { id: string; name: string }

// Stable sensor options (module-level so the reference can't change on the 1-minute re-render and disturb
// an in-progress drag).
const DRAG_ACTIVATION = { activationConstraint: { distance: 6 } }

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
  // `pending` maps a consult id → its optimistic new start-minute while that reschedule write is in flight.
  const [pending, setPending] = React.useState<Record<string, number>>({})
  // Serialize reschedule writes so rapid drags persist in drag order (no last-response-wins race).
  const chainRef = React.useRef<Promise<unknown>>(Promise.resolve())
  // Small activation distance so a plain click still opens the detail dialog (only a real drag moves it).
  const sensors = useSensors(useSensor(PointerSensor, DRAG_ACTIVATION))
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

  // Drag-to-reschedule. Optimistically move the dragged consult while the server write is in flight.
  const tz = defaultTimeZone ?? "America/New_York"
  // Reconcile each optimistic move against the latest server DATA (not a columns-reference compare — the
  // board rebuilds `columns` every 1-minute tick, which would drop the move spuriously). Per-consult (a map)
  // so concurrent drags on different consults don't clobber each other; keep an entry only while its consult
  // exists and hasn't yet reached the TARGET minute (checking the target — not "moved off the original" —
  // keeps an intermediate chained write from clearing a still-pending later target).
  const survivors = Object.entries(pending).filter(([cid, toMin]) => {
    const live = columns.flatMap((c) => c.cal.consults).find((x) => x.id === cid)
    return live !== undefined && live.startMin !== toMin
  })
  if (survivors.length !== Object.keys(pending).length) setPending(Object.fromEntries(survivors))
  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id)
    const consult = columns.flatMap((c) => c.cal.consults).find((x) => x.id === id)
    if (!consult) return
    // Drag from the ON-SCREEN position (the optimistic one if a move is already pending), not the stale
    // server time, so a second drag mid-flight stacks correctly.
    const baseMin = pending[id] ?? consult.startMin
    const toMin = draggedStartMin(baseMin, e.delta.y, PX_PER_MIN)
    if (toMin === baseMin) return // no real move (snapped back to where it already is)
    const startAt = zonedWallTimeToUtcISO(`${date}T${minToHhmm(toMin)}`, tz)
    if (!startAt) {
      toast.error("That time isn't valid on this day.") // e.g. a nonexistent DST spring-forward wall time
      return
    }
    setPending((prev) => ({ ...prev, [id]: toMin }))
    // Scope the revert to THIS write's target so an earlier chained failure can't wipe a newer drag's pending.
    const revert = () =>
      setPending((prev) => {
        if (prev[id] !== toMin) return prev
        const rest = { ...prev }
        delete rest[id]
        return rest
      })
    // Serialize through chainRef so rapid drags apply in drag order (the last drag is the final state).
    chainRef.current = chainRef.current
      .then(() => rescheduleConsultation(id, startAt))
      .then((res) => {
        if (res && "error" in res) {
          toast.error(res.error)
          revert() // spring back
        } else {
          // Server confirmed — the time actually changed (not just the optimistic move).
          toast.success(`Rescheduled to ${formatSlotTime(toMin)}`)
        }
      })
      .catch(() => {
        toast.error("Couldn't reschedule — please try again.")
        revert()
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
