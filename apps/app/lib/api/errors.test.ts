import { describe, expect, test } from "bun:test"

import { apiError, apiJson } from "./errors"

describe("apiError", () => {
  test("wraps code + message in the error envelope with the given status", async () => {
    const res = apiError("invalid_key", "Invalid API key.", 401)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: { code: "invalid_key", message: "Invalid API key." } })
  })

  test("includes details only when provided", async () => {
    const without = await apiError("bad_request", "Bad.", 400).json()
    expect("details" in without.error).toBe(false)

    const withDetails = await apiError("bad_request", "Bad.", 400, { field: "limit" }).json()
    expect(withDetails.error.details).toEqual({ field: "limit" })
  })
})

describe("apiJson", () => {
  test("returns the body verbatim, defaulting to 200", async () => {
    const res = apiJson({ data: [1, 2], next_cursor: null })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [1, 2], next_cursor: null })
  })

  test("honors an explicit status", () => {
    expect(apiJson({ ok: true }, 201).status).toBe(201)
  })
})
