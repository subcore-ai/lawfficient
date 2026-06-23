import { cn } from "@workspace/ui/lib/utils"

import {
  DATA_STATUS_DOT,
  DATA_STATUS_LABEL,
  SHOW_DATA_STATUS,
  type DataStatus,
} from "@/lib/dev/data-status"

// Small per-section status dot for the sidebar (dev aid). Renders nothing outside dev / staging.
export function DataStatusDot({
  status,
  className,
}: {
  status: DataStatus
  className?: string
}) {
  if (!SHOW_DATA_STATUS) return null
  return (
    <span
      title={DATA_STATUS_LABEL[status]}
      className={cn("size-1.5 shrink-0 rounded-full", DATA_STATUS_DOT[status], className)}
    />
  )
}
