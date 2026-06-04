import type * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

export type Stat = { label: string; value: React.ReactNode; tone?: "default" | "danger" | "success" }

export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {stats.map((s) => (
        <div key={s.label} className="bg-card rounded-lg px-4 py-3 ring-1 ring-foreground/10">
          <div
            className={cn(
              "text-2xl font-semibold tabular-nums",
              s.tone === "danger" && "text-red-600 dark:text-red-400",
              s.tone === "success" && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {s.value}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
