"use client"

import * as React from "react"
import Link from "next/link"
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
import { cn } from "@workspace/ui/lib/utils"

import { EntityRowActions } from "@/components/entity-row-actions"
import { InlineSelect } from "@/components/inline-select"
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog"
import { ShowArchivedToggle } from "@/components/show-archived-toggle"
import { StatusPill } from "@/components/status-pill"
import { LEAD_STATUS_LABELS, PIPELINE, STAFF, staffName } from "@/data"
import { useStore } from "@/data/store"
import type { LeadStatus } from "@/data/types"
import { formatDate } from "@/lib/format"
import { qualificationBadge } from "@/lib/status"

const STATUS_OPTIONS = Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const SALES_OPTIONS = STAFF.filter((u) => u.role === "sales").map((u) => ({ value: u.id, label: u.name }))
const SOURCES = ["WhatsApp", "Facebook", "Instagram", "Call Rails", "Website", "Referral"]

export function LeadsTable() {
  const { leads, updateLead } = useStore()
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [source, setSource] = React.useState("all")
  const [showArchived, setShowArchived] = React.useState(false)

  const archivedCount = leads.filter((l) => l.archived).length
  const counts = PIPELINE.map((stage) => ({
    ...stage,
    count: leads.filter((l) => !l.archived && l.status === stage.key).length,
  }))

  const filtered = leads.filter((l) => {
    if (!showArchived && l.archived) return false
    const haystack = `${l.firstName} ${l.lastName} ${l.email} ${l.phone} ${l.city}`.toLowerCase()
    return (
      (query === "" || haystack.includes(query.toLowerCase())) &&
      (status === "all" || l.status === status) &&
      (source === "all" || l.source === source)
    )
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {counts.map((stage) => (
          <div key={stage.key} className="bg-card rounded-lg px-3 py-2.5 ring-1 ring-foreground/10">
            <div className="text-2xl font-semibold tabular-nums">{stage.count}</div>
            <div className="text-muted-foreground mt-0.5 text-xs leading-tight">{stage.label}</div>
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
            onValueChange={(v) => setStatus(v ?? "all")}
            items={[{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]}
          >
            <SelectTrigger className="h-8" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={source}
            onValueChange={(v) => setSource(v ?? "all")}
            items={[{ value: "all", label: "All sources" }, ...SOURCES.map((s) => ({ value: s, label: s }))]}
          >
            <SelectTrigger className="h-8" aria-label="Filter by source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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
              <TableRow key={l.id} className={cn("hover:bg-muted/40", l.archived && "opacity-50")}>
                <TableCell>
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {l.firstName} {l.lastName}
                  </Link>
                  <div className="text-muted-foreground text-xs">{l.email}</div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">{l.source}</TableCell>
                <TableCell>
                  <InlineSelect
                    value={l.status}
                    options={STATUS_OPTIONS}
                    ariaLabel="Status"
                    onValueChange={(v) =>
                      updateLead(l.id, { status: v as LeadStatus }, `Status → ${LEAD_STATUS_LABELS[v as LeadStatus]}`)
                    }
                  />
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <StatusPill {...qualificationBadge(l.qualification)} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <InlineSelect
                    value={l.assignedToId}
                    options={SALES_OPTIONS}
                    ariaLabel="Assignee"
                    onValueChange={(v) => updateLead(l.id, { assignedToId: v }, `Reassigned to ${staffName(v)}`)}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                  {formatDate(l.createdAt)}
                </TableCell>
                <TableCell>
                  <EntityRowActions
                    entity="lead"
                    id={l.id}
                    label={`${l.firstName} ${l.lastName}`}
                    archived={l.archived}
                    editDialog={(p) => <EditLeadDialog lead={l} {...p} />}
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
