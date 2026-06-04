"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { Field } from "@/components/form-field"

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onValueChange={(v) => onChange(v ?? value)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

// Shared option lists for edit dialogs.
export const CASE_STATUS_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "packet_prep", label: "Packet prep" },
  { value: "in_review", label: "In review" },
  { value: "filed", label: "Filed" },
  { value: "rfe", label: "RFE / NOID" },
  { value: "approved", label: "Approved" },
]

export const CLIENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "monthly_plan", label: "Monthly plan" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "terminated", label: "Terminated" },
]

export const CONSULT_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "paid", label: "Paid" },
  { value: "completed", label: "Completed" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "canceled", label: "Canceled" },
  { value: "no_show", label: "No-show" },
]

export const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
]

export const PAYMENT_TYPE_OPTIONS = [
  { value: "down_payment", label: "Down payment" },
  { value: "monthly", label: "Monthly" },
  { value: "full_payment", label: "Full payment" },
  { value: "partial_down", label: "Partial down" },
  { value: "consultation", label: "Consultation" },
  { value: "filing_fee", label: "Filing fee" },
]

export const DOC_CATEGORY_OPTIONS = ["Client Upload", "USCIS Mail", "FBI Prints", "Bona Fides", "Form", "Medical"].map(
  (v) => ({ value: v, label: v }),
)

export const DOC_TYPE_OPTIONS = ["Evidence", "Approval", "RFE", "NOID", "Interview Notice", "Receipt"].map((v) => ({
  value: v,
  label: v,
}))

export const DOC_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "verified", label: "Verified" },
]
