import { cn } from "@workspace/ui/lib/utils"

import { SHOW_DATA_STATUS, type DataStatus } from "@/lib/dev/data-status"

// Dev-only tag for an individual section/card whose data isn't fully wired yet — drop it next to a
// CardTitle. `status="live"` (or outside dev / staging) renders nothing, so a partial page shows the
// tag only on its mock pieces. Remove the tag when that section goes live.
export function MockTag({
  status = "mock",
  className,
}: {
  status?: DataStatus
  className?: string
}) {
  if (!SHOW_DATA_STATUS || status === "live") return null
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-current px-1.5 py-0.5 align-middle text-[10px] font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {status === "partial" ? "partly live" : "mock"}
    </span>
  )
}
