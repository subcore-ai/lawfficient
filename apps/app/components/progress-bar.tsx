import { cn } from "@workspace/ui/lib/utils"

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("bg-muted h-2 w-full overflow-hidden rounded-full", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 100 ? "bg-emerald-500" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
