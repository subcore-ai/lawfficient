// SSRF guards for webhook destinations. A firm-registered URL is fetched server-side, so an internal
// target would let it probe the platform's own network (incl. the cloud metadata IP 169.254.169.254).
//
// Defense in depth, with the authoritative check at DELIVERY: lib/webhooks/emit `deliverOnce` resolves
// the host and runs every resolved address through `isBlockedIp`, and refuses redirects — because a
// public hostname can resolve (or 30x-redirect) to an internal IP, and IP literals have many textual
// encodings a URL-string check can't normalize. `isSafeWebhookUrl` is the fast registration-time reject.
import { isIP } from "node:net"

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".")
  if (parts.length !== 4) return false
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const a = nums[0]!
  const b = nums[1]!
  if (a === 0 || a === 127 || a === 10) return true // unspecified, loopback, private
  if (a === 169 && b === 254) return true // link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  return false
}

// True if `ip` (a concrete address, e.g. from DNS resolution) is loopback / private / link-local /
// unique-local — an internal target a webhook must never reach. Handles IPv4, IPv6, and IPv4-mapped
// IPv6 in both dotted (`::ffff:127.0.0.1`) and normalized-hex (`::ffff:7f00:1`) forms.
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return isBlockedIpv4(ip)
  if (kind !== 6) return false

  const lower = ip.toLowerCase()
  if (lower === "::1" || lower === "::") return true // loopback / unspecified
  if (/^f[cd]/.test(lower)) return true // unique-local fc00::/7
  if (/^fe[89ab]/.test(lower)) return true // link-local fe80::/10

  if (lower.startsWith("::ffff:")) {
    const rest = lower.slice(7)
    if (isIP(rest) === 4) return isBlockedIpv4(rest)
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest)
    if (hex) {
      const hi = parseInt(hex[1]!, 16)
      const lo = parseInt(hex[2]!, 16)
      return isBlockedIpv4(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`)
    }
  }
  return false
}

// Registration-time guard: a fast, clear reject for obviously-internal URLs. Not the last line of
// defense (a hostname is allowed here and re-checked against its resolved IP at delivery).
export function isSafeWebhookUrl(value: string): boolean {
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return false
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false

  let host = u.hostname.toLowerCase()
  if (host.endsWith(".")) host = host.slice(0, -1) // FQDN trailing dot: "localhost." → "localhost"
  if (host === "localhost" || host.endsWith(".localhost")) return false
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1) // unwrap [::1]

  // A literal IP is range-checked now; a hostname passes and is verified against its resolved
  // address at delivery time.
  if (isIP(host) && isBlockedIp(host)) return false
  return true
}
