"use client"

import * as React from "react"

import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

type ComboboxOption = { value: string; label: string }

// A searchable single-select for long option lists (e.g. the lead picker). Rendered INLINE — no portal —
// on purpose: a portaled popover inside the booking dialog disturbed the dialog's scroll lock and jumped
// the page to the top. The list is absolutely positioned within this field and overlays the rows below.
export function Combobox({
  value,
  onValueChange,
  options,
  id,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  disabled,
}: {
  value: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  id?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const activeItemRef = React.useRef<HTMLLIElement>(null)
  const selected = options.find((o) => o.value === value)
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  // Keep the highlighted option scrolled into view (within the list, not the page) as you arrow through.
  React.useEffect(() => {
    if (open) activeItemRef.current?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  function choose(v: string) {
    onValueChange(v)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        id={id}
        autoComplete="off"
        disabled={disabled}
        value={open ? query : (selected?.label ?? "")}
        placeholder={open ? searchPlaceholder : placeholder}
        onFocus={() => {
          setOpen(true)
          setQuery("")
          setActive(0)
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false)
            e.currentTarget.blur()
          } else if (e.key === "ArrowDown") {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(filtered.length - 1, a + 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === "Enter" && open && filtered[active]) {
            e.preventDefault()
            choose(filtered[active].value)
          }
        }}
      />
      {open ? (
        <ul className="bg-popover text-popover-foreground ring-foreground/10 absolute top-full left-0 z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border p-1 shadow-md ring-1">
          {filtered.length === 0 ? (
            <li className="text-muted-foreground px-2 py-1.5 text-sm">{emptyText}</li>
          ) : (
            filtered.map((o, i) => (
              <li key={o.value} ref={i === active ? activeItemRef : null}>
                <button
                  type="button"
                  // Keep the input focused so its blur doesn't close the list before this click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(o.value)}
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                    i === active ? "bg-muted" : "hover:bg-muted",
                    o.value === value && "font-medium",
                  )}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
