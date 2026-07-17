import node from "@astrojs/node";
import { defineConfig } from "astro/config";

/**
 * Multi-tenant shops sit behind Caddy/Traefik (TLS terminates at the edge).
 * Astro CSRF compares Origin to request.url.origin. Without trusting
 * X-Forwarded-*, the Node URL is http://… while the browser Origin is
 * https://… → "Cross-site POST form submissions are forbidden".
 *
 * allowedDomains: [{}] trusts reverse-proxy host/proto for any shop host
 * (required for dynamic *.BASE_DOMAIN). Storefront is not public without Caddy.
 */
const baseDomain =
  process.env.STOREFRONT_PUBLIC_BASE_DOMAIN?.trim() || process.env.BASE_DOMAIN?.trim() || "";

export default defineConfig({
  adapter: node({
    mode: "standalone",
  }),
  output: "server",
  security: {
    checkOrigin: true,
    allowedDomains: [
      {},
      { hostname: "**.lvh.me", protocol: "http" },
      { hostname: "localhost", protocol: "http" },
      ...(baseDomain
        ? [
            { hostname: `**.${baseDomain}`, protocol: "https" },
            { hostname: baseDomain, protocol: "https" },
          ]
        : []),
    ],
  },
  vite: {
    server: {
      allowedHosts: [".lvh.me", "localhost"],
    },
  },
});
