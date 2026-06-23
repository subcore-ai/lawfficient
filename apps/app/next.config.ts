import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  experimental: {
    // Avatar uploads stream through a Server Action; the default body limit is 1 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
}

export default nextConfig
