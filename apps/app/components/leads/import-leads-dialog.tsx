"use client"

import * as React from "react"
import { Upload } from "lucide-react"

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
import { toast } from "@workspace/ui/components/sonner"
import { Textarea } from "@workspace/ui/components/textarea"

import { Field } from "@/components/form-field"
import { useStore } from "@/data/store"

const PLACEHOLDER = `Maria Gonzalez, maria@email.com, (305) 555-0142
Ahmed Hassan, a.hassan@email.com, (718) 555-0198`

export function ImportLeadsDialog() {
  const { addLead } = useStore()
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const rows = text
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean)

    let added = 0
    for (const row of rows) {
      const [name = "", email = "", phone = ""] = row.split(",").map((c) => c.trim())
      if (!name) continue
      const [firstName = name, ...rest] = name.split(" ")
      addLead({
        firstName,
        lastName: rest.join(" "),
        email,
        phone,
        source: "Website",
        preferredLanguage: "English",
        city: "",
        state: "",
        countryOfOrigin: "",
        assignedToId: "u8",
      })
      added += 1
    }

    if (added === 0) {
      toast.error("No rows found", { description: "Paste at least one lead row." })
      return
    }
    toast.success(`${added} lead${added === 1 ? "" : "s"} imported`, {
      description: "Added to the pipeline as new leads.",
    })
    setText("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload className="size-4" /> Import CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Import leads</DialogTitle>
            <DialogDescription>
              Paste one lead per line as <code className="text-xs">name, email, phone</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Field label="Rows">
              <Textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PLACEHOLDER}
                className="font-mono text-xs"
              />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Import leads</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
