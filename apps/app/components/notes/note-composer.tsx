"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import { addNote } from "@/lib/notes/actions"
import type { NoteEntityType } from "@/lib/notes/queries"

// Standalone note composer, split from the activity list so the box can live in its own section.
// Adding a note revalidates the page, so the list re-renders from server data — no shared state.
// Cmd/Ctrl+Enter submits.
export function NoteComposer({
  entityType,
  entityId,
}: {
  entityType: NoteEntityType
  entityId: string
}) {
  const [body, setBody] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    startTransition(async () => {
      try {
        const result = await addNote(entityType, entityId, text)
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        setBody("")
        toast.success("Note added")
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Add a note — a call, a voicemail, something you learned…"
        aria-label="New note"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <Button
        type="submit"
        size="sm"
        className="self-end"
        disabled={pending || !body.trim()}
      >
        Add note
      </Button>
    </form>
  )
}
