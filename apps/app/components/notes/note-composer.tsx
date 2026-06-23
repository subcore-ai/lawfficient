"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import { addNote } from "@/lib/notes/actions"
import type { NoteEntityType, NoteView } from "@/lib/notes/queries"

// Standalone note composer, split from the activity list so the box can live in its own section.
// Cmd/Ctrl+Enter submits. When `onOptimisticAdd` is provided (lead detail), the note appears in the
// timeline + the box clears immediately, reverting if the write fails; otherwise the page revalidate
// refreshes the list.
export function NoteComposer({
  entityType,
  entityId,
  currentUserId = null,
  currentUserName = null,
  onOptimisticAdd,
}: {
  entityType: NoteEntityType
  entityId: string
  currentUserId?: string | null
  currentUserName?: string | null
  onOptimisticAdd?: (note: NoteView) => void
}) {
  const [body, setBody] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    const text = body.trim()
    if (!text) return
    startTransition(async () => {
      onOptimisticAdd?.({
        id: `optimistic-${Date.now()}`,
        entityType,
        entityId,
        kind: "note",
        body: text,
        authorId: currentUserId,
        authorName: currentUserName ?? "You",
        createdAt: new Date().toISOString(),
        editedAt: null,
        resolvedAt: null,
        resolvedById: null,
        hiddenAt: null,
        hiddenById: null,
      })
      setBody("")
      try {
        const result = await addNote(entityType, entityId, text)
        if ("error" in result) {
          toast.error(result.error)
          setBody(text) // restore — the optimistic note reverts when the transition ends
          return
        }
        toast.success("Note added")
      } catch {
        toast.error("Something went wrong. Please try again.")
        setBody(text)
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
