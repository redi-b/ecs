import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["ops.lvh.me"],
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
