"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"

import { staffById } from "@/data"
import { useStore } from "@/data/store"
import type { EntityKind } from "@/data/types"
import { formatDate } from "@/lib/format"

function actorName(byUserId: string) {
  if (byUserId === "system") return "System"
  return staffById(byUserId)?.name ?? "Unknown"
}

export function ActivityTimeline({
  entity,
  id,
  label,
  seedDate,
}: {
  entity: EntityKind
  id: string
  label: string
  seedDate?: string
}) {
  const { auditLog, addNote } = useStore()
  const [note, setNote] = React.useState("")
  const entries = auditLog.filter((e) => e.entity === entity && e.entityId === id)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = note.trim()
    if (!text) return
    addNote(entity, id, label, text)
    setNote("")
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex items-start gap-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={1}
          placeholder="Add a note…"
          className="min-h-9 py-1.5"
        />
        <Button type="submit" size="sm" disabled={!note.trim()}>
          Add
        </Button>
      </form>

      <ol className="relative flex flex-col gap-4 border-l pl-4">
        {entries.map((en) => (
          <li key={en.id} className="relative">
            <span className="bg-primary absolute top-1 -left-[1.3rem] size-2 rounded-full ring-4 ring-background" />
            <p className="text-sm leading-snug">{en.action}</p>
            <p className="text-muted-foreground text-xs">
              {actorName(en.byUserId)} · {en.at}
            </p>
          </li>
        ))}
        {seedDate ? (
          <li className="relative">
            <span className="bg-muted absolute top-1 -left-[1.3rem] size-2 rounded-full ring-4 ring-background" />
            <p className="text-sm leading-snug">Record created</p>
            <p className="text-muted-foreground text-xs">{formatDate(seedDate)}</p>
          </li>
        ) : null}
      </ol>
    </div>
  )
}
