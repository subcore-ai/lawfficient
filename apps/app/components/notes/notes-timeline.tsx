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
  addNote,
  deleteNote,
  editNote,
  setNoteHidden,
  setNoteResolved,
  type ActionResult,
} from "@/lib/notes/actions"
import { formatDate, formatDateTime } from "@/lib/format"
import {
  partitionNotes,
  type NoteEntityType,
  type NoteView,
} from "@/lib/notes/queries"

// Generic activity + note timeline. Renders a record's notes (interactive — addressed notes collapse,
// hidden notes tuck behind a toggle) interleaved with system-recorded events (read-only), newest-first,
// closed by a "Record created" anchor. Any entity (leads today; clients/cases later) reuses it by
// passing its entityType + permissions.
export function NotesTimeline({
  entityType,
  entityId,
  notes,
  createdAt,
  currentUserId,
  canEdit,
  isAdmin,
}: {
  entityType: NoteEntityType
  entityId: string
  notes: NoteView[]
  createdAt: string
  currentUserId: string | null
  canEdit: boolean
  isAdmin: boolean
}) {
  const [body, setBody] = React.useState("")
  const [showHidden, setShowHidden] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editBody, setEditBody] = React.useState("")
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [pending, startTransition] = React.useTransition()

  const { visible, hiddenCount } = partitionNotes(notes, { showHidden })

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

  function submitNew(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    run(
      () => addNote(entityType, entityId, text),
      () => setBody(""),
      "Note added"
    )
  }

  function saveEdit(id: string) {
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
      {canEdit ? (
        <form onSubmit={submitNew} className="flex items-start gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Add a note — a call, a voicemail, something you learned…"
            aria-label="New note"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            Add
          </Button>
        </form>
      ) : null}

      <ol className="relative flex flex-col gap-4 border-l pl-4">
        {visible.map((note) => {
          if (note.kind === "event") {
            return (
              <li key={note.id} className="relative">
                <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
                <p className="text-sm">{note.body}</p>
                <p className="text-xs text-muted-foreground">
                  {note.authorName} · {formatDateTime(note.createdAt)}
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
                    {formatDateTime(note.createdAt)}
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
        <li className="relative">
          <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted ring-4 ring-background" />
          <p className="text-sm">Record created</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(createdAt)}
          </p>
        </li>
      </ol>

      {hiddenCount > 0 ? (
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
