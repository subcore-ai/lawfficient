"use client"

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root data-slot="accordion" className={cn("flex flex-col gap-2", className)} {...props} />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("overflow-hidden rounded-lg border", className)}
      {...props}
    />
  )
}

// Caret sits on the LEFT of the label and rotates ▶ (closed) → ▼ (open).
function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/acc-trigger hover:bg-muted/50 focus-visible:outline-ring flex flex-1 items-center gap-2 px-4 py-3 text-left text-sm font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
          className,
        )}
        {...props}
      >
        <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/acc-trigger:rotate-90" />
        {children}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionPanel({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className="h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0"
      {...props}
    >
      <div className={cn("border-t px-4 py-4", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel }
