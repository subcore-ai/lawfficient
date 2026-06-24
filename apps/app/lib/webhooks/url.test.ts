import { describe, expect, test } from "bun:test"

import { isSafeWebhookUrl } from "./url"

describe("isSafeWebhookUrl", () => {
  test("accepts public http(s) URLs", () => {
    expect(isSafeWebhookUrl("https://hooks.example.com/webhook")).toBe(true)
    expect(isSafeWebhookUrl("http://example.com/x")).toBe(true)
    expect(isSafeWebhookUrl("https://203.0.113.5/x")).toBe(true) // public IP literal
  })

  test("rejects non-http(s) and malformed", () => {
    expect(isSafeWebhookUrl("")).toBe(false)
    expect(isSafeWebhookUrl("ftp://example.com")).toBe(false)
    expect(isSafeWebhookUrl("file:///etc/passwd")).toBe(false)
    expect(isSafeWebhookUrl("not a url")).toBe(false)
  })

  test("rejects loopback / localhost", () => {
    expect(isSafeWebhookUrl("http://localhost:3000/x")).toBe(false)
    expect(isSafeWebhookUrl("http://app.localhost/x")).toBe(false)
    expect(isSafeWebhookUrl("http://127.0.0.1/x")).toBe(false)
    expect(isSafeWebhookUrl("http://127.5.5.5/x")).toBe(false)
    expect(isSafeWebhookUrl("http://[::1]/x")).toBe(false)
  })

  test("rejects private + link-local (SSRF / cloud metadata)", () => {
    expect(isSafeWebhookUrl("http://10.0.0.1/x")).toBe(false)
    expect(isSafeWebhookUrl("http://172.16.0.1/x")).toBe(false)
    expect(isSafeWebhookUrl("http://172.31.255.255/x")).toBe(false)
    expect(isSafeWebhookUrl("http://192.168.1.1/x")).toBe(false)
    expect(isSafeWebhookUrl("http://169.254.169.254/latest/meta-data/")).toBe(false)
    expect(isSafeWebhookUrl("http://0.0.0.0/x")).toBe(false)
  })

  test("accepts public ranges adjacent to private (172.15, 172.32)", () => {
    expect(isSafeWebhookUrl("http://172.15.0.1/x")).toBe(true)
    expect(isSafeWebhookUrl("http://172.32.0.1/x")).toBe(true)
  })
})
