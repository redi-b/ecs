import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.lvh.me"],
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  reactStrictMode: true,
  /**
   * Production only: long-cache hashed `/_next/static/*` chunks.
   * Applying this in development breaks Next.js HMR (stale JS chunks →
   * hydration mismatches and hard-refresh-only updates). Caddy still sets
   * the same header at the edge for deployed traffic.
   */
  async headers() {
    if (!isProd) {
      return [];
    }

    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
