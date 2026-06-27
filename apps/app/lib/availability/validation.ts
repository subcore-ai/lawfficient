// Validation for the office-hours editor: an attorney's submitted weekly windows must be well-formed
// (valid times, start < end) and non-overlapping within each day. Pure + unit-tested; the server
// action (settings.manage) calls this before replacing the attorney's rows. Mirrors the 0040 checks.

export type WindowInput = { weekday: number; startTime: string; endTime: string }

// "HH:MM" or "HH:MM:SS" -> minutes since midnight; null if malformed or out of range. This model is
// minute-precision, so a non-zero seconds component (e.g. "09:00:30", "09:00:99") is rejected rather
// than silently coerced to "09:00" — pg `time` round-trips as ":00".
export function timeToMinutes(time: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  if (m[3] !== undefined && m[3] !== "00") return null
  return h * 60 + min
}

// Validate the full set submitted for one attorney; returns the normalized "HH:MM" windows on success.
// Takes `unknown`: a server action's argument is only a TypeScript contract at the call site, so a
// malformed payload (non-array, null/non-object elements, non-string times) must return an error rather
// than throw.
export function validateWindows(
  windows: unknown
): { ok: true; value: WindowInput[] } | { ok: false; error: string } {
  if (!Array.isArray(windows)) return { ok: false, error: "Invalid office hours." }
  const parsed: { weekday: number; startTime: string; endTime: string; s: number; e: number }[] = []
  for (const w of windows) {
    if (typeof w !== "object" || w === null) return { ok: false, error: "Invalid office hours." }
    const { weekday, startTime, endTime } = w as Record<string, unknown>
    if (typeof startTime !== "string" || typeof endTime !== "string") {
      return { ok: false, error: "Enter a valid time." }
    }
    if (!Number.isInteger(weekday) || (weekday as number) < 0 || (weekday as number) > 6) {
      return { ok: false, error: "Invalid day of week." }
    }
    const s = timeToMinutes(startTime)
    const e = timeToMinutes(endTime)
    if (s === null || e === null) return { ok: false, error: "Enter a valid time." }
    if (s >= e) return { ok: false, error: "Start time must be before end time." }
    parsed.push({ weekday: weekday as number, startTime: startTime.slice(0, 5), endTime: endTime.slice(0, 5), s, e })
  }
  // No overlapping windows within a day (adjacent end == next start is fine).
  for (let d = 0; d <= 6; d++) {
    const day = parsed.filter((w) => w.weekday === d).sort((a, b) => a.s - b.s)
    for (let i = 1; i < day.length; i++) {
      const cur = day[i]
      const prev = day[i - 1]
      if (cur && prev && cur.s < prev.e) {
        return { ok: false, error: "Office-hours windows on the same day can't overlap." }
      }
    }
  }
  const value = parsed.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime }))
  return { ok: true, value }
}
