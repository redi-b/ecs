import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.lvh.me"],
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  reactStrictMode: true,
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
