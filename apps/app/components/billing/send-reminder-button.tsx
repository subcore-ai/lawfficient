"use client"

import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"

export function SendReminderButton({ clientName }: { clientName: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          Send reminder
        </Button>
      }
      title="Send payment reminder?"
      description={`A payment reminder will be emailed and texted to ${clientName}.`}
      confirmLabel="Send reminder"
      onConfirm={() =>
        toast.success("Reminder sent", { description: `Payment reminder sent to ${clientName}.` })
      }
    />
  )
}
