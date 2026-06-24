import { describe, expect, test } from "bun:test"

import { LATEST_VERSION, resolveVersion, VERSION_HEADER } from "./version"

describe("resolveVersion", () => {
  test("defaults to LATEST_VERSION when the header is absent", () => {
    expect(resolveVersion(new Headers())).toBe(LATEST_VERSION)
  })

  test("defaults to LATEST_VERSION when the header is blank", () => {
    expect(resolveVersion(new Headers({ [VERSION_HEADER]: "   " }))).toBe(LATEST_VERSION)
  })

  test("echoes a requested version, trimmed", () => {
    expect(resolveVersion(new Headers({ [VERSION_HEADER]: " 2026-07-01 " }))).toBe("2026-07-01")
  })
})
