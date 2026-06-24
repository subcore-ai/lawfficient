import { describe, expect, test } from "bun:test"

import {
  buildEvent,
  endpointWantsEvent,
  LEAD_EVENT_TYPES,
  WEBHOOK_EVENT_TYPES,
} from "./events"

describe("event registry", () => {
  test("ships the five Phase-1 lead lifecycle events", () => {
    expect(LEAD_EVENT_TYPES).toEqual([
      "lead.created",
      "lead.updated",
      "lead.status_changed",
      "lead.assigned",
      "lead.archived",
    ])
  })

  test("the catalog includes every lead event", () => {
    for (const t of LEAD_EVENT_TYPES) {
      expect(WEBHOOK_EVENT_TYPES).toContain(t)
    }
  })

  test("event types follow resource.action naming", () => {
    for (const t of WEBHOOK_EVENT_TYPES) {
      expect(t).toMatch(/^[a-z]+\.[a-z_]+$/)
    }
  })
})

describe("endpointWantsEvent (filtering)", () => {
  test("matches an exactly-subscribed type", () => {
    expect(endpointWantsEvent(["lead.created", "lead.updated"], "lead.created")).toBe(true)
  })

  test("does not match an unsubscribed type", () => {
    expect(endpointWantsEvent(["lead.created"], "lead.archived")).toBe(false)
  })

  test("an empty subscription matches nothing", () => {
    expect(endpointWantsEvent([], "lead.created")).toBe(false)
  })

  test("a wildcard subscription matches any type", () => {
    expect(endpointWantsEvent(["*"], "lead.assigned")).toBe(true)
    expect(endpointWantsEvent(["*"], "lead.status_changed")).toBe(true)
  })
})

describe("buildEvent (envelope shape)", () => {
  test("wraps data in { id, type, created_at, data }", () => {
    const data = { id: "lead_1", first_name: "Ada" }
    const event = buildEvent("lead.created", data)
    expect(event.type).toBe("lead.created")
    expect(event.data).toEqual(data)
    // id is a uuid; created_at is an ISO-8601 string.
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(() => new Date(event.created_at).toISOString()).not.toThrow()
    expect(new Date(event.created_at).toISOString()).toBe(event.created_at)
  })

  test("gives each event a unique id", () => {
    expect(buildEvent("lead.created", {}).id).not.toBe(buildEvent("lead.created", {}).id)
  })

  test("serializes to JSON with exactly the envelope keys", () => {
    const event = buildEvent("lead.updated", { id: "lead_2" })
    const parsed = JSON.parse(JSON.stringify(event))
    expect(Object.keys(parsed).sort()).toEqual(["created_at", "data", "id", "type"])
  })
})
