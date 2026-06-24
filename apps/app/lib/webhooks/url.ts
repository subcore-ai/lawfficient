// SSRF guard for webhook destination URLs. A firm-registered URL is fetched server-side, so an
// internal / loopback / link-local target would let it probe the platform's own network — including
// the cloud metadata endpoint at 169.254.169.254. Reject those hosts at registration.
//
// Limitation (follow-up): this blocks literal internal hosts/IPs, but a *public* hostname that
// resolves to a private IP (DNS rebinding), or an obfuscated-encoding IP (octal/hex/decimal), needs
// the resolved address checked at delivery time. Tracked for the durable-delivery worker.
export function isSafeWebhookUrl(value: string): boolean {
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return false
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false

  let host = u.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return false

  // Unwrap an IPv6 literal: [::1] → ::1
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1)
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return false // loopback / unspecified
    if (/^f[cd]/.test(host)) return false // unique-local fc00::/7
    if (/^fe[89ab]/.test(host)) return false // link-local fe80::/10
    return true
  }

  // IPv4 literal → reject loopback / private / link-local / unspecified ranges.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a > 255 || b > 255 || Number(m[3]) > 255 || Number(m[4]) > 255) return false
    if (a === 0 || a === 127 || a === 10) return false // unspecified, loopback, private
    if (a === 169 && b === 254) return false // link-local (incl. 169.254.169.254 metadata)
    if (a === 172 && b >= 16 && b <= 31) return false // private
    if (a === 192 && b === 168) return false // private
  }
  return true
}
