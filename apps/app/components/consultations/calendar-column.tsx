"use client"

import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog"
import type { ConsultationType } from "@/lib/consultations/consultation-types"
import { formatSlotTime, type CalendarConsult, type CalendarSlot, type CalendarWindow } from "@/lib/scheduling/day-calendar"

type Option = { id: string; name: string }

export const PX_PER_MIN = 0.9

// One attorney's day, as the BODY of a calendar column: office hours shaded, booked consults as blocks,
// free slots as click-to-book buttons. Absolutely positioned inside a `relative` parent and aligned to a
// SHARED `gridStartMin` so every column in the multi-attorney view lines up on the same hour lines.
export function CalendarColumn({
  windows,
  consults,
  slots,
  gridStartMin,
  attorneyId,
  typeName,
  leads,
  attorneys,
  consultationTypes,
  defaultTimeZone,
  canBook,
}: {
  windows: CalendarWindow[]
  consults: CalendarConsult[]
  slots: CalendarSlot[]
  gridStartMin: number
  attorneyId: string
  typeName: string
  leads: Option[]
  attorneys: Option[]
  consultationTypes: ConsultationType[]
  defaultTimeZone: string | null
  canBook: boolean
}) {
  const top = (min: number) => (min - gridStartMin) * PX_PER_MIN
  const height = (mins: number) => Math.max(mins * PX_PER_MIN, 16)

  return (
    <>
      {/* Office hours shading. */}
      {windows.map((w, i) => (
        <div
          key={`w-${i}`}
          className="bg-muted/50 absolute inset-x-0.5 rounded"
          style={{ top: top(w.startMin), height: height(w.endMin - w.startMin) }}
        />
      ))}

      {/* Free slots — click to book. */}
      {slots.map((s) => {
        const style = { top: top(s.startMin), height: height(s.endMin - s.startMin) }
        const label = formatSlotTime(s.startMin)
        if (!canBook) {
          return (
            <div
              key={s.startMs}
              className="border-primary/40 text-primary/70 absolute inset-x-0.5 overflow-hidden rounded border border-dashed px-1.5 text-[11px] leading-tight"
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
            prefillStartIso={new Date(s.startMs).toISOString()}
            prefillAttorneyId={attorneyId}
            prefillType={typeName}
            trigger={
              <button
                type="button"
                aria-label={`Book ${label}`}
                className="border-primary/40 text-primary hover:bg-primary/10 absolute inset-x-0.5 cursor-pointer overflow-hidden rounded border border-dashed px-1.5 text-left text-[11px] leading-tight transition-colors"
                style={style}
              >
                {label}
              </button>
            }
          />
        )
      })}

      {/* Booked consults — drawn over slots/shading. */}
      {consults.map((c) => (
        <div
          key={c.id}
          title={`${c.leadName} · ${c.type} · ${formatSlotTime(c.startMin)}`}
          className="bg-primary/85 text-primary-foreground absolute inset-x-0.5 overflow-hidden rounded px-1.5 py-0.5 text-[11px] leading-tight shadow-sm"
          style={{ top: top(c.startMin), height: height(c.endMin - c.startMin) }}
        >
          <span className="block truncate font-medium">{c.leadName}</span>
          <span className="block truncate opacity-80">{c.type}</span>
        </div>
      ))}
    </>
  )
}
