import type * as React from "react"

export function DetailList({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}
