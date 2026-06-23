"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { assignLead, setLeadStatus } from "@/app/(app)/leads/actions"
import { InlineSelect } from "@/components/inline-select"
import { LeadRowActions } from "@/components/leads/lead-row-actions"
import { ShowArchivedToggle } from "@/components/show-archived-toggle"
import { StatusPill } from "@/components/status-pill"
import type { AssigneeOption, LeadStatusView, LeadView } from "@/lib/leads/queries"
import { formatDate } from "@/lib/format"
import { qualificationBadge } from "@/lib/status"
import type { FirmTaxonomies } from "@/lib/taxonomies/queries"

// Distinctive sentinels so a free-text lead source (or assignee) can't collide with them.
const ALL = "__all__"
const UNASSIGNED = "__none__"

export function LeadsTable({
  leads,
  statuses,
  assignees,
  taxonomies,
  canEdit,
  canManage,
}: {
  leads: LeadView[]
  statuses: LeadStatusView[]
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  canEdit: boolean
  canManage: boolean
}) {
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState(ALL)
  const [source, setSource] = React.useState(ALL)
  const [assignee, setAssignee] = React.useState(ALL)
  const [showArchived, setShowArchived] = React.useState(false)
  const [, startTransition] = React.useTransition()
  const router = useRouter()

  const statusOptions = statuses.map((s) => ({ value: s.id, label: s.name }))
  const assigneeName = new Map(assignees.map((a) => [a.id, a.name]))
  const inlineAssignee = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...assignees.map((a) => ({ value: a.id, label: a.name })),
  ]
  const sources = Array.from(new Set(leads.map((l) => l.source))).sort()

  const archivedCount = leads.filter((l) => l.archived).length
  const counts = statuses.map((s) => ({
    ...s,
    count: leads.filter((l) => !l.archived && l.status.id === s.id).length,
  }))

  const filtered = leads.filter((l) => {
    if (!showArchived && l.archived) return false
    const haystack = `${l.firstName} ${l.lastName} ${l.email} ${l.phone} ${l.data.city ?? ""}`.toLowerCase()
    return (
      (query === "" || haystack.includes(query.toLowerCase())) &&
      (status === ALL || l.status.id === status) &&
      (source === ALL || l.source === source) &&
      (assignee === ALL ||
        (assignee === UNASSIGNED ? !l.assignedToId : l.assignedToId === assignee))
    )
  })

  function onStatusChange(id: string, statusId: string) {
    startTransition(async () => {
      const result = await setLeadStatus(id, statusId)
      if ("error" in result) toast.error(result.error)
    })
  }
  function onAssign(id: string, value: string) {
    startTransition(async () => {
      const result = await assignLead(id, value === UNASSIGNED ? "" : value)
      if ("error" in result) toast.error(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {counts.map((stage) => (
          <div key={stage.id} className="bg-card rounded-lg px-3 py-2.5 ring-1 ring-foreground/10">
            <div className="text-2xl font-semibold tabular-nums">{stage.count}</div>
            <div className="text-muted-foreground mt-0.5 text-xs leading-tight">{stage.name}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone…"
            className="h-8 pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v ?? ALL)}
            items={[{ value: ALL, label: "All statuses" }, ...statusOptions]}
          >
            <SelectTrigger className="h-8" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={source}
            onValueChange={(v) => setSource(v ?? ALL)}
            items={[{ value: ALL, label: "All sources" }, ...sources.map((s) => ({ value: s, label: s }))]}
          >
            <SelectTrigger className="h-8" aria-label="Filter by source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={assignee}
            onValueChange={(v) => setAssignee(v ?? ALL)}
            items={[
              { value: ALL, label: "All assignees" },
              { value: UNASSIGNED, label: "Unassigned" },
              ...assignees.map((a) => ({ value: a.id, label: a.name })),
            ]}
          >
            <SelectTrigger className="h-8" aria-label="Filter by assignee">
              <SelectValue placeholder="Assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All assignees</SelectItem>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 sm:ml-auto">
          <ShowArchivedToggle checked={showArchived} onChange={setShowArchived} count={archivedCount} />
          <span className="text-muted-foreground text-xs">
            {filtered.length} of {leads.length}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden xl:table-cell">Qualification</TableHead>
              <TableHead className="hidden lg:table-cell">Assigned</TableHead>
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow
                key={l.id}
                // Whole-row click navigates to the lead (pointer convenience). The name <Link> stays
                // the keyboard/screen-reader path; the interactive cells below stopPropagation so the
                // Status/Assigned selects and the ⋯ menu work without navigating.
                onClick={(e) => {
                  // Let interactive controls handle their own clicks (the inline Status/Assigned
                  // selects, the ⋯ menu, the name link); navigate from anywhere else in the row.
                  if (
                    (e.target as HTMLElement).closest(
                      'a, button, [data-slot="select-trigger"]',
                    )
                  )
                    return
                  // Modifier-clicks (open in a new tab/window) belong to the name <Link>, not the row.
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return
                  // Don't hijack a text selection made *within this row* (e.g. copying an email);
                  // a selection elsewhere on the page shouldn't block row navigation.
                  const sel = window.getSelection()
                  if (
                    sel &&
                    !sel.isCollapsed &&
                    (e.currentTarget.contains(sel.anchorNode) ||
                      e.currentTarget.contains(sel.focusNode))
                  )
                    return
                  router.push(`/leads/${l.id}`)
                }}
                className={cn(
                  "hover:bg-muted/40 cursor-pointer",
                  l.archived && "opacity-50",
                )}
              >
                <TableCell>
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {l.firstName} {l.lastName}
                  </Link>
                  <div className="text-muted-foreground text-xs">{l.email}</div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">{l.source}</TableCell>
                <TableCell>
                  <InlineSelect
                    value={l.status.id}
                    options={statusOptions}
                    ariaLabel="Status"
                    disabled={!canEdit}
                    onValueChange={(v) => onStatusChange(l.id, v)}
                  />
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {l.data.qualification ? (
                    <StatusPill {...qualificationBadge(l.data.qualification)} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {canEdit ? (
                    <InlineSelect
                      value={l.assignedToId ?? UNASSIGNED}
                      options={inlineAssignee}
                      ariaLabel="Assignee"
                      onValueChange={(v) => onAssign(l.id, v)}
                    />
                  ) : (
                    <span className="text-sm">
                      {l.assignedToId ? (assigneeName.get(l.assignedToId) ?? "—") : "Unassigned"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                  {formatDate(l.createdAt)}
                </TableCell>
                <TableCell>
                  <LeadRowActions
                    lead={l}
                    assignees={assignees}
                    taxonomies={taxonomies}
                    canEdit={canEdit}
                    canManage={canManage}
                  />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                  No leads match your filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
