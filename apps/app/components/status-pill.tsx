import { cn } from "@workspace/ui/lib/utils"

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "purple"

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/25",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
  danger: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25",
  purple:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25",
}

export function StatusPill({
  label,
  tone = "neutral",
  dot = false,
  className,
}: {
  label: string
  tone?: Tone
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {label}
    </span>
  )
}
