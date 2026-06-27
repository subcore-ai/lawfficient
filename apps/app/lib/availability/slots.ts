// Pure slot engine (spec 13, Phase 2). Given an attorney's availability windows for a day and the
// consultations already booked that day, produce the free start times for a consultation of a given
// length. Works entirely in UTC epoch-ms intervals — the caller converts the firm-timezone office-hours
// wall times on a date into UTC windows (and the consults into UTC intervals) before calling, so this
// stays pure + unit-testable. The DB exclusion constraint (0043) is the hard no-double-book guarantee;
// this just offers the slots a booker can actually take.

export type Interval = { start: number; end: number } // [start, end) in epoch ms (UTC)

export function generateSlots(opts: {
  windows: Interval[]
  booked: Interval[]
  durationMs: number
  // Gap between consecutive slot starts; defaults to the duration (clean, back-to-back slots). A smaller
  // step yields more (overlapping) start options.
  stepMs?: number
  // Slots that start before this are dropped (no booking in the past).
  nowMs: number
}): number[] {
  const { windows, booked, durationMs, nowMs } = opts
  const stepMs = opts.stepMs ?? durationMs
  if (durationMs <= 0 || stepMs <= 0) return []

  const slots: number[] = []
  // Sort windows so the output is start-ordered regardless of input order.
  const sortedWindows = [...windows].sort((a, b) => a.start - b.start)
  for (const w of sortedWindows) {
    // A slot must fit entirely within the window: last start is window.end - duration.
    for (let s = w.start; s + durationMs <= w.end; s += stepMs) {
      if (s < nowMs) continue
      const e = s + durationMs
      // Half-open overlap test: [s, e) clashes with [b.start, b.end) iff s < b.end && e > b.start.
      const conflict = booked.some((b) => s < b.end && e > b.start)
      if (!conflict) slots.push(s)
    }
  }
  return slots
}
