"use client"

import * as React from "react"

import { Checkbox } from "@workspace/ui/components/checkbox"
import { cn } from "@workspace/ui/lib/utils"

import { ProgressBar } from "@/components/progress-bar"
import { ToastButton } from "@/components/toast-button"
import { documentChecklistFor } from "@/data"
import { useStore } from "@/data/store"
import type { CaseType } from "@/data/types"

export function DocumentChecklist({
  caseId,
  caseType,
  initialComplete,
}: {
  caseId: string
  caseType: CaseType
  initialComplete: number
}) {
  const { updateCase } = useStore()
  const items = React.useMemo(() => documentChecklistFor(caseType), [caseType])
  const [checked, setChecked] = React.useState<boolean[]>(() => {
    const seed = Math.round((initialComplete / 100) * items.length)
    return items.map((_, i) => i < seed)
  })

  const done = checked.filter(Boolean).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0
  const pending = items.length - done

  function toggle(i: number, value: boolean) {
    setChecked((prev) => {
      const next = prev.slice()
      next[i] = value
      const d = next.filter(Boolean).length
      updateCase(caseId, { checklistComplete: Math.round((d / next.length) * 100) })
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {done} of {items.length} documents received
        </span>
        <span className="text-muted-foreground text-sm tabular-nums">{pct}%</span>
      </div>
      <ProgressBar value={pct} />
      <div className="flex flex-col divide-y">
        {items.map((label, i) => {
          const isChecked = checked[i] ?? false
          return (
            <label key={label} className="flex cursor-pointer items-center gap-3 py-2.5">
              <Checkbox checked={isChecked} onCheckedChange={(v) => toggle(i, v === true)} />
              <span className={cn("text-sm", isChecked && "text-muted-foreground line-through")}>{label}</span>
            </label>
          )
        })}
      </div>
      {pending > 0 ? (
        <ToastButton
          variant="outline"
          size="sm"
          className="w-fit"
          message="Reminder sent"
          description={`Requested ${pending} missing document${pending === 1 ? "" : "s"} from the client.`}
        >
          Request missing documents
        </ToastButton>
      ) : (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">All documents received.</p>
      )}
    </div>
  )
}
