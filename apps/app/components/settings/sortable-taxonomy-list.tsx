"use client"

import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import { toast } from "@workspace/ui/components/sonner"

import { reorderTaxonomies } from "@/app/(app)/settings/taxonomies/actions"
import { TAXONOMY_ROW_CLASS, TaxonomyRowContent } from "@/components/settings/taxonomy-row"
import type { TaxonomyCategory, TaxonomyOption } from "@/lib/taxonomies/queries"

function SortableRow({ option }: { option: TaxonomyOption }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${TAXONOMY_ROW_CLASS} bg-card ${isDragging ? "relative z-10 shadow-sm" : ""}`}
    >
      <TaxonomyRowContent
        option={option}
        canManage
        handle={
          <button
            type="button"
            aria-label={`Reorder ${option.label}`}
            className="text-muted-foreground hover:text-foreground -ml-1 cursor-grab touch-none rounded p-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  )
}

export function SortableTaxonomyList({
  category,
  options,
}: {
  category: TaxonomyCategory
  options: TaxonomyOption[]
}) {
  const [items, setItems] = React.useState(options)
  // Re-sync with server data (a create/edit/delete/revalidate hands us a new array) without losing the
  // optimistic order: on success the revalidated `options` already match, so this is a no-op then.
  const [snapshot, setSnapshot] = React.useState(options)
  if (snapshot !== options) {
    setSnapshot(options)
    setItems(options)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((o) => o.id === active.id)
    const newIndex = items.findIndex((o) => o.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const prev = items
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next) // optimistic
    void reorderTaxonomies(
      category,
      next.map((o) => o.id),
    ).then((res) => {
      if ("error" in res) {
        setItems(prev) // revert on failure
        toast.error(res.error)
      }
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        {items.map((o) => (
          <SortableRow key={o.id} option={o} />
        ))}
      </SortableContext>
    </DndContext>
  )
}
