"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"

/**
 * Dual-mode edit dialog: pass `trigger` for an inline button, or control it with
 * `open`/`onOpenChange` (e.g. opened from a row-actions menu). `onSubmit` receives the
 * form's FormData; selects are controlled in the caller and read from closure state.
 */
export function EditDialogShell({
  title,
  description,
  trigger,
  open,
  onOpenChange,
  onSubmit,
  children,
  submitLabel = "Save changes",
  className = "sm:max-w-lg",
}: {
  title: string
  description?: string
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit: (data: FormData) => void
  children: React.ReactNode
  submitLabel?: string
  className?: string
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSubmit(new FormData(e.currentTarget))
    setOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className={className}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="grid gap-4 py-5 sm:grid-cols-2">{children}</div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
