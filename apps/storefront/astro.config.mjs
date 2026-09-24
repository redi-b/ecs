import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { defineConfig } from "astro/config";

import { ecsRedisCache } from "./src/cache/ecs-redis-cache.ts";
import { templateCssScopePostcss } from "./src/lib/css/template-css-scope.ts";

/**
 * Multi-tenant shops sit behind Caddy/Traefik (TLS terminates at the edge).
 * Astro CSRF compares Origin to request.url.origin. Without trusting
 * X-Forwarded-*, the Node URL is http://… while the browser Origin is
 * https://… → "Cross-site POST form submissions are forbidden".
 *
 * allowedDomains: [{}] trusts reverse-proxy host/proto for any shop host
 * (required for dynamic *.BASE_DOMAIN). Storefront is not public without Caddy.
 *
 * Cache: Redis-backed HTML cache (multi-tenant keys include Host). Catalog
 * pages opt in via Astro.cache.set; cart/checkout stay private.
 */
const baseDomain =
  process.env.STOREFRONT_PUBLIC_BASE_DOMAIN?.trim() || process.env.BASE_DOMAIN?.trim() || "";

export default defineConfig({
  adapter: node({
    mode: "standalone",
  }),
  output: "server",
  prefetch: {
    defaultStrategy: "tap",
    prefetchAll: false,
  },
  cache: {
    provider: ecsRedisCache({
      redisUrl: process.env.REDIS_URL,
      prefix: process.env.STOREFRONT_CACHE_PREFIX || "ecs:sf:cache",
    }),
  },
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
    plugins: [
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/paraglide",
        emitTsDeclarations: true,
        strategy: ["baseLocale"],
      }),
    ],
    css: {
      // Scope each template's CSS under .template-<name> (class on <html>) so
      // luvia/nexahub/afro can share class names without colliding.
      postcss: {
        plugins: [templateCssScopePostcss()],
      },
      preprocessorOptions: {
        scss: {
          loadPaths: [fileURLToPath(new URL("./", import.meta.url))],
          additionalData: (source, filename) => {
            const normalized = filename.replaceAll("\\", "/");
            if (
              normalized.includes("/_abstracts.scss") ||
              normalized.includes("/_variables.scss") ||
              normalized.includes("/_functions.scss")
            ) {
              return source;
            }
            if (normalized.includes("/templates/nexahub/")) {
              return `@use "src/templates/nexahub/v1/styles/abstracts" as *;\n${source}`;
            }
            if (normalized.includes("/templates/afro/")) {
              return `@use "src/templates/afro/v1/styles/abstracts" as *;\n${source}`;
            }
            return source;
          },
        },
      },
    },
    server: {
      allowedHosts: true,
      watch: {
        ignored: ["**/.astro/**"],
      },
    },
  },
});
