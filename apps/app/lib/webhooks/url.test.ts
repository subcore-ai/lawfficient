import { describe, expect, test } from "bun:test"

import { isBlockedIp, isSafeWebhookUrl } from "./url"

describe("isBlockedIp", () => {
  test("blocks IPv4 loopback / private / link-local / unspecified", () => {
    for (const ip of [
      "127.0.0.1",
      "127.5.5.5",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "0.0.0.0",
    ]) {
      expect(isBlockedIp(ip)).toBe(true)
    }
  })

  test("allows public IPv4 (incl. ranges adjacent to private)", () => {
    for (const ip of ["203.0.113.5", "8.8.8.8", "172.15.0.1", "172.32.0.1"]) {
      expect(isBlockedIp(ip)).toBe(false)
    }
  })

  test("blocks IPv6 loopback / ULA / link-local and IPv4-mapped (dotted + hex)", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1", // normalized form of ::ffff:127.0.0.1
      "::ffff:10.0.0.1",
    ]) {
      expect(isBlockedIp(ip)).toBe(true)
    }
  })

  test("allows public IPv6 and non-IP strings", () => {
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false)
    expect(isBlockedIp("::ffff:8.8.8.8")).toBe(false)
    expect(isBlockedIp("example.com")).toBe(false) // not an IP literal
  })
})

describe("isSafeWebhookUrl", () => {
  test("accepts public http(s) URLs", () => {
    expect(isSafeWebhookUrl("https://hooks.example.com/webhook")).toBe(true)
    expect(isSafeWebhookUrl("http://example.com/x")).toBe(true)
    expect(isSafeWebhookUrl("https://203.0.113.5/x")).toBe(true)
  })

  test("rejects non-http(s) and malformed", () => {
    expect(isSafeWebhookUrl("")).toBe(false)
    expect(isSafeWebhookUrl("ftp://example.com")).toBe(false)
    expect(isSafeWebhookUrl("file:///etc/passwd")).toBe(false)
    expect(isSafeWebhookUrl("not a url")).toBe(false)
  })

  test("rejects localhost, incl. trailing-dot FQDN and subdomains", () => {
    expect(isSafeWebhookUrl("http://localhost:3000/x")).toBe(false)
    expect(isSafeWebhookUrl("http://localhost./x")).toBe(false) // trailing-dot bypass
    expect(isSafeWebhookUrl("http://app.localhost/x")).toBe(false)
  })

  test("rejects literal loopback / private / link-local IPs (v4 + v6 incl. mapped)", () => {
    expect(isSafeWebhookUrl("http://127.0.0.1/x")).toBe(false)
    expect(isSafeWebhookUrl("http://10.0.0.1/x")).toBe(false)
    expect(isSafeWebhookUrl("http://169.254.169.254/latest/meta-data/")).toBe(false)
    expect(isSafeWebhookUrl("http://[::1]/x")).toBe(false)
    expect(isSafeWebhookUrl("http://[::ffff:127.0.0.1]/x")).toBe(false)
  })
})
