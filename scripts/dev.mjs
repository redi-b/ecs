#!/usr/bin/env node
/**
 * Full local bootstrap:
 *   infra → migrate platform + medusa → seed token/templates → start apps
 *
 *   pnpm dev
 *   pnpm dev --grouped
 *   pnpm dev --split-medusa
 */
import {
  blank,
  box,
  error,
  formatMs,
  heading,
  info,
  run,
  step,
  success,
} from "./lib/cli.mjs";

const passthrough = process.argv.slice(2).filter((arg) => arg !== "--");
const startedAt = Date.now();

const bootstrap = [
  {
    label: "Start local infrastructure (postgres, redis, minio, caddy)",
    run: () => run("pnpm", ["dev:infra"]),
  },
  {
    label: "Run platform database migrations",
    run: () => run("pnpm", ["db:migrate"]),
  },
  {
    label: "Run Medusa migrations",
    run: () => run("pnpm", ["medusa:migrate"]),
  },
  {
    label: "Bootstrap Medusa API token + storefront templates",
    run: () => run("pnpm", ["seed", "--write-env"]),
  },
];

heading("ECS local development");
info("Bootstrap then start app processes");
blank();

for (const [index, item] of bootstrap.entries()) {
  step(index + 1, bootstrap.length, item.label);
  const began = Date.now();
  try {
    item.run();
  } catch {
    error(`Bootstrap failed at step ${index + 1}: ${item.label}`);
    process.exit(1);
  }
  success(`done in ${formatMs(Date.now() - began)}`);
  blank();
}

const bootstrapMs = Date.now() - startedAt;

blank();
box([
  "Bootstrap complete",
  `Total setup time  ${formatMs(bootstrapMs)}`,
  "",
  "Dashboard   http://dashboard.lvh.me/admin",
  "API         http://api.lvh.me",
  "Storefront  http://*.lvh.me (tenant hosts)",
  "Medusa      http://localhost:9000",
  "",
  "Demo shops (after pnpm seed:demo):",
  "  addis-tech.lvh.me  ·  bole-style.lvh.me",
]);
blank();

info("Starting application processes…");
if (passthrough.length) {
  info(`Flags: ${passthrough.join(" ")}`);
}
blank();

const apps = run("pnpm", ["dev:apps", ...passthrough], {
  // dev:apps is long-running; inherit stdio and exit with its code.
});

process.exit(apps.status ?? 0);
