#!/usr/bin/env node
/**
 * Bootstrap after empty/migrated databases (local convenience).
 *
 * 1. Medusa: ETB region + secret Admin API key
 * 2. Platform: sync storefront templates
 * 3. Optionally write MEDUSA_ADMIN_API_TOKEN to apps/platform-api/.env
 *
 * Production: leave MEDUSA_ADMIN_API_TOKEN empty; platform-api auto-bootstraps
 * and stores the token encrypted in platform_system_secrets.
 *
 *   pnpm seed
 *   pnpm seed --write-env
 *
 * For demo shops/catalog: pnpm seed:demo (Medusa must be running).
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { blank, error, heading, info, kv, run, success, warn } from "./lib/cli.mjs";

const writeEnv = process.argv.includes("--write-env");
const platformEnvPath = resolve("apps/platform-api/.env");

heading("ECS bootstrap seed");
kv([
  ["Write .env", writeEnv ? "yes → apps/platform-api/.env" : "no (print token only)"],
  ["Demo data", "not included — use pnpm seed:demo"],
]);
blank();

info("[1/2] Medusa seed (shared ETB region + secret API key)");
const medusa = run("pnpm", ["--filter", "@ecs/medusa", "seed"], { capture: true });
if (medusa.stdout) process.stdout.write(medusa.stdout);

const token = medusa.stdout?.match(/"medusaAdminApiToken"\s*:\s*"([^"]+)"/)?.[1];
if (!token) {
  error("Failed to parse medusaAdminApiToken from Medusa seed output.");
  process.exit(1);
}
success("Medusa secret API key created");

blank();
info("[2/2] Sync storefront templates");
run("pnpm", ["--filter", "@ecs/platform-api", "exec", "tsx", "src/sync-storefront-templates.ts"]);
success("Templates synchronized");

if (writeEnv) {
  if (!existsSync(platformEnvPath)) {
    error(`Missing ${platformEnvPath}. Copy apps/platform-api/.env.example first.`);
    process.exit(1);
  }

  let envText = readFileSync(platformEnvPath, "utf8");
  if (/^MEDUSA_ADMIN_API_TOKEN=/m.test(envText)) {
    envText = envText.replace(/^MEDUSA_ADMIN_API_TOKEN=.*$/m, `MEDUSA_ADMIN_API_TOKEN=${token}`);
    writeFileSync(platformEnvPath, envText);
  } else {
    appendFileSync(platformEnvPath, `\nMEDUSA_ADMIN_API_TOKEN=${token}\n`);
  }
  success(`Wrote MEDUSA_ADMIN_API_TOKEN to ${platformEnvPath}`);
} else {
  warn("Token not written to .env — pass --write-env to persist it");
}

blank();
heading("Bootstrap complete");
kv([
  ["MEDUSA_ADMIN_API_TOKEN", token],
  [
    "Next",
    writeEnv
      ? "Restart platform-api if it is already running, then pnpm dev:apps"
      : "pnpm seed --write-env   or set the token manually",
  ],
  ["Demo shops", "pnpm seed:demo  (after apps are up)"],
]);
blank();
