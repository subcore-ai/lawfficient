"use client"

import * as React from "react"
import { ArrowRight } from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

import { StageTracker } from "@/components/stage-tracker"
import { DECLARATION_STAGES } from "@/data"

export function DeclarationTab({ requiresDeclaration }: { requiresDeclaration: boolean }) {
  const [stage, setStage] = React.useState(3)

  if (!requiresDeclaration) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">
          This case type does not require a client declaration.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.success("Declaration requested", { description: "Assigned to the creative writers' team." })}
        >
          Request a declaration anyway
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Stage {stage} of 9</span>
          {stage < 9 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStage((s) => Math.min(9, s + 1))
                toast.success(`Declaration advanced to stage ${Math.min(9, stage + 1)}`)
              }}
            >
              <ArrowRight className="size-4" /> Advance
            </Button>
          ) : (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Completed</span>
          )}
        </div>
        <StageTracker stages={DECLARATION_STAGES} current={stage} />
      </div>
      <div className="flex h-fit flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Creative writer</p>
        <div className="flex items-center gap-3">
          <UserAvatar name="Lena Hoffmann" className="size-9" />
          <div>
            <p className="text-sm font-medium">Lena Hoffmann</p>
            <p className="text-muted-foreground text-xs">Creative Writer</p>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          The declaration moves through 9 stages with per-stage SLAs; delays flag the case and
          notify the creative writers&apos; team lead.
        </p>
      </div>
    </div>
  )
}
