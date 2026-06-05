"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { StatusPill } from "@/components/status-pill"
import { staffById } from "@/data"
import { useStore } from "@/data/store"

function actorName(byUserId: string) {
  if (byUserId === "system") return "System"
  return staffById(byUserId)?.name ?? "Unknown"
}

export function AuditLogCard() {
  const { auditLog } = useStore()
  const recent = auditLog.slice(0, 12)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Recent changes across the firm — every edit, status change, and archive is logged</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
        ) : (
          recent.map((e) => (
            <div
              key={e.id}
              className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm leading-snug">
                  <span className="font-medium">{e.label}</span> — {e.action}
                </p>
                <p className="text-muted-foreground text-xs">
                  {actorName(e.byUserId)} · {e.at}
                </p>
              </div>
              <StatusPill label={e.entity} tone="neutral" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
