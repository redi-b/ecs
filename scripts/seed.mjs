#!/usr/bin/env node
/**
 * Required bootstrap after empty/migrated databases.
 *
 * 1. Medusa: ETB region + secret Admin API key
 * 2. Platform: sync storefront templates
 * 3. Optionally write MEDUSA_ADMIN_API_TOKEN to apps/platform-api/.env
 *
 * Usage:
 *   pnpm seed              # print token
 *   pnpm seed --write-env  # also write apps/platform-api/.env
 *
 * Does not create demo shops. For sample catalog data: pnpm seed:demo
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const writeEnv = process.argv.includes("--write-env");
const platformEnvPath = resolve("apps/platform-api/.env");

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    if (capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
  return capture ? `${result.stdout ?? ""}${result.stderr ?? ""}` : "";
}

console.info("→ [1/2] Medusa seed (region + secret API key)");
const medusaOut = run("pnpm", ["--filter", "@ecs/medusa", "seed"], { capture: true });
process.stdout.write(medusaOut);

const token = medusaOut.match(/"medusaAdminApiToken"\s*:\s*"([^"]+)"/)?.[1];
if (!token) {
  console.error("Failed to parse medusaAdminApiToken from Medusa seed output.");
  process.exit(1);
}

console.info("→ [2/2] Sync storefront templates");
run("pnpm", ["--filter", "@ecs/platform-api", "exec", "tsx", "src/sync-storefront-templates.ts"]);

if (writeEnv) {
  if (!existsSync(platformEnvPath)) {
    console.error(`Missing ${platformEnvPath}. Copy apps/platform-api/.env.example first.`);
    process.exit(1);
  }
  let envText = readFileSync(platformEnvPath, "utf8");
  if (/^MEDUSA_ADMIN_API_TOKEN=/m.test(envText)) {
    envText = envText.replace(/^MEDUSA_ADMIN_API_TOKEN=.*$/m, `MEDUSA_ADMIN_API_TOKEN=${token}`);
    writeFileSync(platformEnvPath, envText);
  } else {
    appendFileSync(platformEnvPath, `\nMEDUSA_ADMIN_API_TOKEN=${token}\n`);
  }
  console.info(`Wrote MEDUSA_ADMIN_API_TOKEN to ${platformEnvPath}`);
}

console.info(`
Done. MEDUSA_ADMIN_API_TOKEN=${token}

Next:
  ${writeEnv ? "Restart platform-api if it is already running." : "Add the token to apps/platform-api/.env (or re-run: pnpm seed --write-env)"}
  pnpm dev:apps

  Optional sample shops/catalog:
  pnpm seed:demo

Production: set MEDUSA_ADMIN_API_TOKEN in Dokploy and restart platform-api.
Do not run seed:demo on production unless you want demo shops.
`);
