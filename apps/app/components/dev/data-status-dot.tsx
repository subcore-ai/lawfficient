import { cn } from "@workspace/ui/lib/utils"

import {
  DATA_STATUS_DOT,
  DATA_STATUS_LABEL,
  SHOW_DATA_STATUS,
  type DataStatus,
} from "@/lib/dev/data-status"

// Small per-section status dot for the sidebar (dev aid). Renders nothing outside dev / staging.
// Rendered as <i>, not <span>, on purpose: the sidebar menu button owns a
// `[&>span:last-child]:truncate` rule for the nav title, so a trailing <span> here would capture it
// and stop long labels from ellipsizing. role="img" + aria-label announces it to screen readers.
export function DataStatusDot({
  status,
  className,
}: {
  status: DataStatus
  className?: string
}) {
  if (!SHOW_DATA_STATUS) return null
  return (
    <i
      role="img"
      aria-label={DATA_STATUS_LABEL[status]}
      title={DATA_STATUS_LABEL[status]}
      className={cn("inline-block size-1.5 shrink-0 rounded-full", DATA_STATUS_DOT[status], className)}
    />
  )
}
