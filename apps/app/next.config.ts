import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  experimental: {
    // Avatar uploads stream through a Server Action (the 1 MB default is too small).
    // Set ABOVE the 4 MB file cap (profile actions): this limit covers the whole
    // multipart body — boundaries, part headers, field metadata — so the headroom keeps
    // Next from rejecting a near-4 MB file before our own friendly size check runs.
    serverActions: { bodySizeLimit: "5mb" },
  },
}

export default nextConfig
