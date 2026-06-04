"use client"

import * as React from "react"
import { TriangleAlert, Upload } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

import { StatusPill } from "@/components/status-pill"

const SHEETS = [
  {
    id: "pre4",
    label: "Stage 3 → 4 corrections sign-off",
    note: "Required before endorsing to the document-review attorney (Stage 4).",
    doneAtStage: 4,
  },
  {
    id: "post4",
    label: "Post Stage 4 review sign-off",
    note: "Required after the document-review attorney's corrections.",
    doneAtStage: 5,
  },
]

export function SignOffs({ stage }: { stage: number }) {
  const [uploaded, setUploaded] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(SHEETS.map((s) => [s.id, stage >= s.doneAtStage])),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg p-3 text-xs">
        <TriangleAlert className="text-amber-500 mt-px size-4 shrink-0" />
        <span>Advancing the packet past Stage 4 is blocked until both sign-off sheets are uploaded.</span>
      </div>
      {SHEETS.map((s) => {
        const isUp = uploaded[s.id] ?? false
        return (
          <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-muted-foreground text-xs">{s.note}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill
                label={isUp ? "Uploaded" : "Pending"}
                tone={isUp ? "success" : "warning"}
                dot
              />
              {isUp ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUploaded((p) => ({ ...p, [s.id]: true }))
                    toast.success("Sign-off uploaded", { description: s.label })
                  }}
                >
                  <Upload className="size-4" /> Upload
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
