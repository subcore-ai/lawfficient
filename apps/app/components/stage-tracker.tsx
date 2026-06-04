import { Check } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export function StageTracker({
  stages,
  current,
  inProgressLabel = "In progress",
}: {
  stages: readonly string[]
  current: number
  inProgressLabel?: string
}) {
  return (
    <ol className="flex flex-col">
      {stages.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        const last = n === stages.length
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  done && "bg-primary text-primary-foreground",
                  active && "ring-primary text-primary ring-2",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : n}
              </span>
              {last ? null : <span className={cn("w-px flex-1", done ? "bg-primary" : "bg-border")} />}
            </div>
            <div className={cn("pb-4", last && "pb-0")}>
              <p
                className={cn(
                  "text-sm leading-6",
                  active ? "font-medium" : done ? "" : "text-muted-foreground",
                )}
              >
                {label}
              </p>
              {active ? <p className="text-primary text-xs">{inProgressLabel}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
