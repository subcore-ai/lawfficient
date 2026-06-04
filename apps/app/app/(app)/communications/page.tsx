import type * as React from "react"
import {
  CalendarClock,
  CircleDollarSign,
  FileText,
  FolderKanban,
  MessageSquare,
  Phone,
  Smartphone,
  Users,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { FollowUpDialog } from "@/components/communications/follow-up-dialog"
import { PageHeader } from "@/components/page-header"
import { StatStrip } from "@/components/stat-strip"
import { StatusPill } from "@/components/status-pill"
import { ACTIVITY, staffName, TASKS } from "@/data"
import type { Activity } from "@/data/types"
import { priorityBadge } from "@/lib/status"

export const metadata = { title: "Communications" }

const ICON: Record<Activity["kind"], React.ComponentType<{ className?: string }>> = {
  lead: Users,
  consultation: CalendarClock,
  payment: CircleDollarSign,
  case: FolderKanban,
  document: FileText,
  message: MessageSquare,
}

const PRONGS = [
  { icon: MessageSquare, label: "Portal message", desc: "Send the update through the MyCase portal." },
  { icon: Smartphone, label: "Text message", desc: "Mirror the same summary as an SMS." },
  { icon: Phone, label: "Phone call", desc: "Confirm documents, questions, and commitment dates." },
]

export default function CommunicationsPage() {
  const pending = TASKS.filter((t) => t.status !== "completed").length

  return (
    <>
      <PageHeader
        title="Communications"
        description="Automated notifications, follow-ups, and routed client requests."
      />

      <StatStrip
        stats={[
          { label: "Messages sent today", value: 42 },
          { label: "Pending follow-ups", value: pending },
          { label: "Scheduled callbacks", value: 3 },
          { label: "Monthly updates due", value: 8 },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notification center</CardTitle>
            <CardDescription>Recent automated and manual notifications</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5">
            {ACTIVITY.map((a) => {
              const Icon = ICON[a.kind]
              return (
                <div key={a.id} className="flex gap-3">
                  <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{a.text}</p>
                    <p className="text-muted-foreground text-xs">{a.at}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Routed tasks</CardTitle>
            <CardDescription>Requests routed to the assigned legal assistant</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {TASKS.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {staffName(t.assigneeId)} · {t.dueLabel}
                  </p>
                </div>
                <StatusPill {...priorityBadge(t.priority)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Three-pronged client follow-up</CardTitle>
          <CardDescription>
            Reach document-gathering clients through all three channels, then log a single shared
            summary.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {PRONGS.map((p) => (
              <div key={p.label} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                  <p.icon className="size-4" />
                </div>
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-muted-foreground text-xs leading-snug">{p.desc}</p>
              </div>
            ))}
          </div>
          <FollowUpDialog />
        </CardContent>
      </Card>
    </>
  )
}
