// Deterministic formatters — parse date strings by hand so server and client
// render identically regardless of timezone (avoids hydration mismatches).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

export function formatCurrencyCents(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

/** Accepts "YYYY-MM-DD" or full ISO. Returns e.g. "Jun 5, 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** Short form without year, e.g. "Jun 5". */
export function formatDateShort(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!m || !d) return iso
  return `${MONTHS[m - 1]} ${d}`
}

/** Full ISO with time → "Jun 5, 3:00 PM". */
export function formatDateTime(iso: string): string {
  const datePart = formatDateShort(iso)
  const t = iso.split("T")[1]
  if (!t) return datePart
  const [hh = 0, mm = 0] = t.split(":").map(Number)
  const period = hh >= 12 ? "PM" : "AM"
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${datePart}, ${h12}:${String(mm).padStart(2, "0")} ${period}`
}

/** "3:00 PM" from a full ISO timestamp. */
export function formatTime(iso: string): string {
  const t = iso.split("T")[1]
  if (!t) return ""
  const [hh = 0, mm = 0] = t.split(":").map(Number)
  const period = hh >= 12 ? "PM" : "AM"
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
