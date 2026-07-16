// Base UI Selects can't hold null, so "no selection" travels through the UI as a sentinel string.
// The reserved "__" prefix keeps it from colliding with a firm-defined taxonomy label (e.g. one
// literally named "none") or a free-text lead source — taxonomy create/rename rejects "__"-prefixed
// labels (see settings actions). The sentinel never reaches the database: map it back with
// noneToEmpty (FormData / server actions read "" as cleared) or noneToNull before persisting.
export const NONE = "__none__"

/** Select items for a person picker: "Unassigned" first, then each person by id. */
export function personOptions(people: { id: string; name: string }[]) {
  return [
    { value: NONE, label: "Unassigned" },
    ...people.map((p) => ({ value: p.id, label: p.name })),
  ]
}

export function noneToEmpty(value: string) {
  return value === NONE ? "" : value
}

export function noneToNull(value: string) {
  return value === NONE ? null : value
}
