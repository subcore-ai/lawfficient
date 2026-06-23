// Build-time aid: surface which parts of the app are wired to real (Supabase) data vs. still on the
// mock store, while the app is being built out. Two levels use this:
//   - a per-section dot in the sidebar (page rollup)        → components/dev/data-status-dot.tsx
//   - a <MockTag> you drop on an individual card/section    → components/dev/mock-tag.tsx
//
// Visible in local dev automatically; on a deployed build only when NEXT_PUBLIC_SHOW_DATA_STATUS=1
// (so set that in the staging Vercel env to demo it there) — real production stays clean. Remove the
// flag / the badges at launch.

export type DataStatus = "live" | "partial" | "mock"

export const SHOW_DATA_STATUS =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_SHOW_DATA_STATUS === "1"

export const DATA_STATUS_LABEL: Record<DataStatus, string> = {
  live: "Live data",
  partial: "Partly live",
  mock: "Mock data",
}

// Dot colour per status (sidebar + legend).
export const DATA_STATUS_DOT: Record<DataStatus, string> = {
  live: "bg-emerald-500",
  partial: "bg-amber-500",
  mock: "bg-muted-foreground/40",
}
