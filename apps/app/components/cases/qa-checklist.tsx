"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { QA_CHECKLIST } from "@/data"

export function QaChecklist({ caseName }: { caseName: string }) {
  const [checked, setChecked] = React.useState<boolean[]>(() => QA_CHECKLIST.map(() => false))
  const done = checked.filter(Boolean).length
  const all = done === QA_CHECKLIST.length

  function toggle(i: number, value: boolean) {
    setChecked((prev) => {
      const next = prev.slice()
      next[i] = value
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">QA review checklist</span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {done}/{QA_CHECKLIST.length}
        </span>
      </div>
      <div className="flex flex-col divide-y">
        {QA_CHECKLIST.map((item, i) => {
          const isChecked = checked[i] ?? false
          return (
            <label key={item.label} className="flex cursor-pointer items-start gap-3 py-2.5">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(v) => toggle(i, v === true)}
                className="mt-0.5"
              />
              <div className="flex flex-col">
                <span className={cn("text-sm", isChecked && "text-muted-foreground")}>{item.label}</span>
                {item.ref ? <span className="text-muted-foreground text-xs">Ref: {item.ref}</span> : null}
              </div>
            </label>
          )
        })}
      </div>
      <Button
        size="sm"
        className="w-fit"
        disabled={!all}
        onClick={() =>
          toast.success("QA review submitted", { description: `Checklist completed for ${caseName}.` })
        }
      >
        Submit QA review
      </Button>
    </div>
  )
}
