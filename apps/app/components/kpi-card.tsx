import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import type { Kpi } from "@/data/types"

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const negative = kpi.delta < 0
  const flat = kpi.delta === 0
  const Icon = negative ? ArrowDownRight : ArrowUpRight

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardDescription>{kpi.label}</CardDescription>
        <CardTitle className="text-2xl tracking-tight tabular-nums">{kpi.value}</CardTitle>
        {flat ? null : (
          <CardAction>
            <span
              className={cn(
                "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
                negative
                  ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
              )}
            >
              <Icon className="size-3.5" />
              {Math.abs(kpi.delta)}%
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">{kpi.hint}</p>
      </CardContent>
    </Card>
  )
}
