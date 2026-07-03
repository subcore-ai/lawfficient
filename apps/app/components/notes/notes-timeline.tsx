"use client"

import * as React from "react"
import {
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  deleteNote,
  editNote,
  setNoteHidden,
  setNoteResolved,
} from "@/lib/notes/actions"
import { LocalTime } from "@/components/local-time"
import type { ActionResult } from "@/lib/actions/result"
import { partitionNotes, type NoteView } from "@/lib/notes/queries"

type Filter = "all" | "note" | "event"
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "note", label: "Notes" },
  { value: "event", label: "Events" },
]

// Activity list: a record's notes (interactive — addressed notes collapse, hidden notes tuck behind a
// toggle) interleaved with system-recorded events (read-only), newest-first, closed by a "Record
// created" anchor. A type filter narrows to notes vs events. The composer is separate (NoteComposer)
// so it can live in its own section of the page.
export function NotesTimeline({
  notes,
  createdAt,
  currentUserId,
  canEdit,
  isAdmin,
}: {
  notes: NoteView[]
  createdAt: string
  currentUserId: string | null
  canEdit: boolean
  isAdmin: boolean
}) {
  const [showHidden, setShowHidden] = React.useState(false)
  const [filter, setFilter] = React.useState<Filter>("all")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editBody, setEditBody] = React.useState("")
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [pending, startTransition] = React.useTransition()

  const { visible, hiddenCount } = partitionNotes(notes, { showHidden })
  const items =
    filter === "all" ? visible : visible.filter((n) => n.kind === filter)
  const showAnchor = filter !== "note" // "Record created" is an event-type marker

  function run(
    fn: () => Promise<ActionResult>,
    onOk?: () => void,
    okMsg?: string
  ) {
    startTransition(async () => {
      try {
        const result = await fn()
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        onOk?.()
        if (okMsg) toast.success(okMsg)
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  function saveEdit(id: string) {
    if (pending) return
    const text = editBody.trim()
    if (!text) return
    run(
      () => editNote(id, text),
      () => setEditingId(null),
      "Note updated"
    )
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="xs"
            variant={filter === f.value ? "secondary" : "ghost"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {items.length === 0 && !showAnchor ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l pl-4">
          {items.map((note) => {
            if (note.kind === "event") {
              return (
                <li key={note.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
                  <p className="text-sm">{note.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {note.authorName} · <LocalTime iso={note.createdAt} />
                  </p>
                </li>
              )
            }
            const isResolved = !!note.resolvedAt
            const isHidden = !!note.hiddenAt
            const collapsible = isResolved || isHidden
            const isOpen = !collapsible || expanded.has(note.id)
            const isEditing = editingId === note.id
            const isAuthor =
              currentUserId !== null && note.authorId === currentUserId
            const canDelete = isAdmin || isAuthor

            return (
              <li key={note.id} className="relative">
                <span
                  className={`absolute top-1.5 -left-[1.3rem] size-2 rounded-full ring-4 ring-background ${
                    isHidden
                      ? "bg-muted-foreground/40"
                      : isResolved
                        ? "bg-muted-foreground"
                        : "bg-primary"
                  }`}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="font-medium">{note.authorName}</span>
                    <span className="text-muted-foreground">
                      <LocalTime iso={note.createdAt} />
                    </span>
                    {note.editedAt ? (
                      <span className="text-muted-foreground">· edited</span>
                    ) : null}
                    {isResolved ? (
                      <Badge variant="secondary">Addressed</Badge>
                    ) : null}
                    {isHidden ? <Badge variant="outline">Hidden</Badge> : null}
                  </div>
                  {(canEdit || canDelete) && !isEditing ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Note actions"
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit ? (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                run(
                                  () => setNoteResolved(note.id, !isResolved),
                                  undefined,
                                  isResolved ? "Reopened" : "Marked addressed"
                                )
                              }
                            >
                              {isResolved ? <Undo2 /> : <CheckCheck />}
                              {isResolved ? "Reopen" : "Mark addressed"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                run(
                                  () => setNoteHidden(note.id, !isHidden),
                                  undefined,
                                  isHidden ? "Unhidden" : "Hidden"
                                )
                              }
                            >
                              {isHidden ? <Eye /> : <EyeOff />}
                              {isHidden ? "Unhide" : "Hide"}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {canEdit && isAuthor ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingId(note.id)
                              setEditBody(note.body)
                            }}
                          >
                            <Pencil /> Edit
                          </DropdownMenuItem>
                        ) : null}
                        {canDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                run(
                                  () => deleteNote(note.id),
                                  undefined,
                                  "Note deleted"
                                )
                              }
                            >
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                {isEditing ? (
                  <div className="mt-1.5 flex flex-col gap-2">
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      aria-label="Edit note"
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault()
                          saveEdit(note.id)
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(note.id)}
                        disabled={pending || !editBody.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    <p
                      className={`text-sm whitespace-pre-wrap ${isOpen ? "" : "line-clamp-1"} ${
                        collapsible && !isOpen ? "text-muted-foreground" : ""
                      }`}
                    >
                      {note.body}
                    </p>
                    {collapsible ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(note.id)}
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-3" />
                        ) : (
                          <ChevronRight className="size-3" />
                        )}
                        {isOpen ? "Collapse" : "Expand"}
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            )
          })}
          {showAnchor ? (
            <li className="relative">
              <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted ring-4 ring-background" />
              <p className="text-sm">Record created</p>
              <p className="text-xs text-muted-foreground">
                <LocalTime iso={createdAt} mode="date" />
              </p>
            </li>
          ) : null}
        </ol>
      )}

      {hiddenCount > 0 && filter !== "event" ? (
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          className="self-start text-xs text-muted-foreground hover:text-foreground"
        >
          {showHidden ? "Hide" : "Show"} {hiddenCount} hidden{" "}
          {hiddenCount === 1 ? "note" : "notes"}
        </button>
      ) : null}
    </div>
  )
}
