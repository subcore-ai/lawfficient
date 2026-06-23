// Firm default time-zone options (Settings → General). Stored as IANA ids so the value
// is future-proof for real time-zone math; the label is what staff see. US-centric for
// now — extend this list if the firm operates elsewhere.
export const FIRM_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Mountain — Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
] as const

export type FirmTimezone = (typeof FIRM_TIMEZONES)[number]["value"]

const VALUES = new Set<string>(FIRM_TIMEZONES.map((t) => t.value))
export function isFirmTimezone(value: string): boolean {
  return VALUES.has(value)
}
