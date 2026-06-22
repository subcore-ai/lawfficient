import { describe, expect, test } from "bun:test"

import { coreUpdatePatch } from "./store"

describe("coreUpdatePatch", () => {
  test("omits empty fields, so a re-delivery never blanks an existing value", () => {
    // A retry that only carries email must not wipe the stored phone/notes.
    expect(
      coreUpdatePatch({ firstName: "Ada", lastName: "Lovelace", email: "ada@x.co", phone: "", notes: "" })
    ).toEqual({ first_name: "Ada", last_name: "Lovelace", email: "ada@x.co" })
  })

  test("a full payload patches every core column", () => {
    expect(
      coreUpdatePatch({ firstName: "A", lastName: "B", email: "a@b.co", phone: "+14155550123", notes: "hi" })
    ).toEqual({ first_name: "A", last_name: "B", email: "a@b.co", phone: "+14155550123", notes: "hi" })
  })
})
