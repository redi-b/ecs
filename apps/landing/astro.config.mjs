// @ts-check

import path from "node:path";
import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import compressor from "astro-compressor";
import icon from "astro-icon";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin that intercepts Windows system-locked file errors (e.g. EBUSY on DumpStack.log.tmp)
 * emitted by the underlying Chokidar file watcher, preventing unhandled error crashes.
 * @returns {import("vite").Plugin}
 */
function windowsWatcherFixPlugin() {
  return {
    name: "vite-plugin-windows-watcher-fix",
    configureServer(server) {
      server.watcher.on("error", (err) => {
        // Intercept and safely ignore Windows kernel/system-locked file errors (EBUSY, EPERM, EACCES)
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES")
        ) {
          return;
        }
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "http://ecs.lvh.me",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [icon(), sitemap(), compressor({ gzip: true, brotli: true, zstd: false })],
  image: {
    layout: "constrained",
    objectFit: "cover",
    objectPosition: "center",
    breakpoints: [500, 750, 828, 1080, 1280],
    responsiveStyles: true,
  },
  server: {
    port: 4322,
    host: "0.0.0.0",
  },
  vite: {
    plugins: [windowsWatcherFixPlugin()],
    server: {
      fs: {
        strict: true,
        allow: [path.resolve(__dirname)],
      },
      allowedHosts: ["ecs.lvh.me"],
      watch: {
        ignored: [
          "**/DumpStack.log.tmp",
          "**/dumpstack.log.tmp",
          "**/pagefile.sys",
          "**/hiberfil.sys",
          "**/swapfile.sys",
        ],
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: [path.resolve(__dirname, "src/styles")],
          additionalData: `@use "abstracts" as *;\n`,
        },
      },
    },
  },
});
