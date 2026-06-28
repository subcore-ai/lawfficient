"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Phone, Search } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { assignLead, setLeadStatus } from "@/app/(app)/leads/actions"
import { InlineSelect } from "@/components/inline-select"
import { LeadRowActions } from "@/components/leads/lead-row-actions"
import { ShowArchivedToggle } from "@/components/show-archived-toggle"
import { StatusPill } from "@/components/status-pill"
import { formatDate } from "@/lib/format"
import { LEAD_SOURCES } from "@/lib/leads/validation"
import type { AssigneeOption, LeadStatusView, LeadView } from "@/lib/leads/queries"
import { qualificationBadge } from "@/lib/status"
import type { FirmTaxonomies } from "@/lib/taxonomies/queries"

// Distinctive sentinels so a free-text lead source (or assignee) can't collide with them.
const ALL = "__all__"
const UNASSIGNED = "__none__"

export type LeadsFilters = {
  status: string
  source: string
  assignee: string
  q: string
  showArchived: boolean
}

export function LeadsTable({
  leads,
  statuses,
  statusCounts,
  archivedCount,
  assignees,
  taxonomies,
  filters,
  page,
  pageSize,
  total,
  canEdit,
  canManage,
}: {
  leads: LeadView[]
  statuses: LeadStatusView[]
  statusCounts: Record<string, number>
  archivedCount: number
  assignees: AssigneeOption[]
  taxonomies: FirmTaxonomies
  filters: LeadsFilters
  page: number
  pageSize: number
  total: number
  canEdit: boolean
  canManage: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = React.useTransition()

  // Filter/search/page state lives in the URL (so the server re-fetches the right slice). The current params
  // are rebuilt from props — no useSearchParams, so no Suspense boundary is forced. Any filter change resets
  // paging to page 1; an explicit `page` update keeps it.
  const setParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams()
      if (filters.status) params.set("status", filters.status)
      if (filters.source) params.set("source", filters.source)
      if (filters.assignee) params.set("assignee", filters.assignee)
      if (filters.q) params.set("q", filters.q)
      if (filters.showArchived) params.set("archived", "1")
      if (page > 1) params.set("page", String(page))
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k)
        else params.set(k, v)
      }
      if (!("page" in updates)) params.delete("page")
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, filters, page],
  )

  // Debounced search: type instantly (local state), push the URL ~300ms after the user stops.
  const [q, setQ] = React.useState(filters.q)
  const [urlQ, setUrlQ] = React.useState(filters.q)
  if (filters.q !== urlQ) {
    // URL changed under us (back/forward, or a reset) — resync the input.
    setUrlQ(filters.q)
    setQ(filters.q)
  }
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  function onSearch(value: string) {
    setQ(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setParams({ q: value || null }), 300)
  }

  const statusOptions = statuses.map((s) => ({ value: s.id, label: s.name }))
  const assigneeName = new Map(assignees.map((a) => [a.id, a.name]))
  const inlineAssignee = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...assignees.map((a) => ({ value: a.id, label: a.name })),
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

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
        {statuses.map((stage) => {
          const active = filters.status === stage.id
          return (
            <button
              key={stage.id}
              type="button"
              aria-pressed={active}
              onClick={() => setParams({ status: active ? null : stage.id })}
              className={cn(
                "bg-card focus-visible:outline-ring rounded-lg px-3 py-2.5 text-left ring-1 transition outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
                active ? "ring-foreground/40" : "ring-foreground/10 hover:ring-foreground/25",
              )}
            >
              <div className="text-2xl font-semibold tabular-nums">{statusCounts[stage.id] ?? 0}</div>
              <div className="text-muted-foreground mt-0.5 text-xs leading-tight">{stage.name}</div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="h-8 pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filters.status || ALL}
            onValueChange={(v) => setParams({ status: !v || v === ALL ? null : v })}
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
            value={filters.source || ALL}
            onValueChange={(v) => setParams({ source: !v || v === ALL ? null : v })}
            items={[{ value: ALL, label: "All sources" }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]}
          >
            <SelectTrigger className="h-8" aria-label="Filter by source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.assignee || ALL}
            onValueChange={(v) => setParams({ assignee: !v || v === ALL ? null : v })}
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
          <ShowArchivedToggle
            checked={filters.showArchived}
            onChange={(v) => setParams({ archived: v ? "1" : null })}
            count={archivedCount}
          />
          <span className="text-muted-foreground text-xs tabular-nums">
            {start}–{end} of {total}
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
            {leads.map((l) => (
              <TableRow
                key={l.id}
                // Whole-row click navigates to the lead (pointer convenience). The name <Link> stays
                // the keyboard/screen-reader path; the interactive cells below stopPropagation so the
                // Status/Assigned selects and the ⋯ menu work without navigating.
                onClick={(e) => {
                  if (
                    e.target instanceof Element &&
                    e.target.closest('a, button, [data-slot="select-trigger"]')
                  )
                    return
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return
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
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                    {l.email ? <span>{l.email}</span> : null}
                    {l.phone ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <a
                              href={`tel:${l.phone}`}
                              aria-label={`Call ${l.phone}`}
                              className="hover:text-foreground inline-flex shrink-0"
                            />
                          }
                        >
                          <Phone className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent onClick={(e) => e.stopPropagation()}>{l.phone}</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">{l.source}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <InlineSelect
                      value={l.status.id}
                      options={statusOptions}
                      ariaLabel="Status"
                      onValueChange={(v) => onStatusChange(l.id, v)}
                    />
                  ) : (
                    <StatusPill label={l.status.name} tone={l.status.tone} />
                  )}
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
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                  No leads match your filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs tabular-nums">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setParams({ page: String(page + 1) })}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
