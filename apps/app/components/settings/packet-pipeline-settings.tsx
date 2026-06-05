"use client"

import { ChevronDown, ChevronUp, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { ROLE_LABELS } from "@/data"
import { useStore } from "@/data/store"

export function PacketPipelineSettings() {
  const {
    packetPipeline,
    addPacketStage,
    updatePacketStage,
    removePacketStage,
    movePacketStage,
    resetPacketPipeline,
    currentRole,
  } = useStore()

  const canEdit = currentRole === "admin"
  const totalDays = packetPipeline.reduce((sum, s) => sum + s.slaDays, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Packet pipeline</CardTitle>
            <CardDescription>
              Firm-wide stages every case packet moves through, with per-stage turnaround SLAs.
            </CardDescription>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetPacketPipeline()
                  toast.success("Pipeline reset to the default")
                }}
              >
                <RotateCcw className="size-4" /> Reset
              </Button>
              <Button size="sm" onClick={addPacketStage}>
                <Plus className="size-4" /> Add stage
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!canEdit ? (
          <p className="text-muted-foreground bg-muted/40 rounded-lg p-3 text-xs">
            Viewing as {ROLE_LABELS[currentRole]}. Only admins can edit the packet pipeline.
          </p>
        ) : null}

        {packetPipeline.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-2 rounded-lg border p-2">
            <GripVertical className="text-muted-foreground size-4 shrink-0" />
            <span className="text-muted-foreground w-5 shrink-0 text-center text-xs tabular-nums">
              {i + 1}
            </span>
            <Input
              value={stage.name}
              disabled={!canEdit}
              onChange={(e) => updatePacketStage(stage.id, { name: e.target.value })}
              className="h-8 flex-1"
              aria-label={`Stage ${i + 1} name`}
            />
            <div className="flex shrink-0 items-center gap-1.5">
              <Input
                type="number"
                min={0}
                value={stage.slaDays}
                disabled={!canEdit}
                onChange={(e) =>
                  updatePacketStage(stage.id, { slaDays: Math.max(0, Number(e.target.value) || 0) })
                }
                className="h-8 w-16"
                aria-label={`Stage ${i + 1} SLA days`}
              />
              <span className="text-muted-foreground w-7 text-xs">days</span>
            </div>
            <div className="flex shrink-0 items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canEdit || i === 0}
                onClick={() => movePacketStage(stage.id, -1)}
                aria-label="Move up"
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canEdit || i === packetPipeline.length - 1}
                onClick={() => movePacketStage(stage.id, 1)}
                aria-label="Move down"
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={!canEdit || packetPipeline.length <= 1}
                onClick={() => removePacketStage(stage.id)}
                aria-label="Remove stage"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            {packetPipeline.length} stages · expected turnaround{" "}
            <span className="text-foreground font-medium tabular-nums">{totalDays} days</span>
          </span>
          <span>Per-case-type pipelines coming later — this is the firm-wide default.</span>
        </div>
      </CardContent>
    </Card>
  )
}
