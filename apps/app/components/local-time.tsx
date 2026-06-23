"use client"

import * as React from "react"

import { formatDate, formatDateTime } from "@/lib/format"

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
}
const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
}

// No external store to subscribe to — the value only needs to differ between server and client.
const subscribe = () => () => {}

// Deterministic UTC wall-clock string (matches the server render).
function utc(iso: string, mode: "date" | "datetime") {
  return mode === "date" ? formatDate(iso) : formatDateTime(iso)
}

// Stored timestamps are UTC instants; render them in the viewer's local timezone (staff are
// multi-tenant and can be anywhere). useSyncExternalStore returns the deterministic UTC string on the
// server and during hydration — so there's no mismatch — then swaps in the local-timezone value on
// the client. Falls back to the UTC string for an unparseable date.
export function LocalTime({
  iso,
  mode = "datetime",
}: {
  iso: string
  mode?: "date" | "datetime"
}) {
  const text = React.useSyncExternalStore(
    subscribe,
    () => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return utc(iso, mode)
      return d.toLocaleString("en-US", mode === "date" ? DATE_OPTS : DATETIME_OPTS)
    },
    () => utc(iso, mode)
  )
  return <time dateTime={iso}>{text}</time>
}
