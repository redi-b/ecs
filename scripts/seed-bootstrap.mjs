#!/usr/bin/env node
/**
 * Production-like bootstrap after empty DBs:
 * 1) Medusa region + secret Admin API key
 * 2) Storefront template registry sync
 *
 * Does NOT create demo shops/users (use pnpm seed + seed:demo for that).
 *
 * Usage:
 *   pnpm seed:bootstrap
 *   pnpm seed:bootstrap --write-env   # append token to apps/platform-api/.env
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const writeEnv = process.argv.includes("--write-env");
const platformEnvPath = resolve("apps/platform-api/.env");

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    env: process.env,
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.info("→ Medusa bootstrap seed (region + secret API key)…");
const medusaOut = runCapture("pnpm", ["--filter", "@ecs/medusa", "seed"]);
process.stdout.write(medusaOut);

const tokenMatch = medusaOut.match(/"medusaAdminApiToken"\s*:\s*"([^"]+)"/);
const token = tokenMatch?.[1];

if (!token) {
  console.error("Could not parse medusaAdminApiToken from Medusa seed output.");
  process.exit(1);
}

console.info("→ Syncing storefront templates…");
run("pnpm", ["--filter", "@ecs/platform-api", "exec", "tsx", "src/sync-storefront-templates.ts"]);

if (writeEnv) {
  if (!existsSync(platformEnvPath)) {
    console.error(`Missing ${platformEnvPath}. Copy from .env.example first.`);
    process.exit(1);
  }
  let envText = readFileSync(platformEnvPath, "utf8");
  if (/^MEDUSA_ADMIN_API_TOKEN=/m.test(envText)) {
    envText = envText.replace(/^MEDUSA_ADMIN_API_TOKEN=.*$/m, `MEDUSA_ADMIN_API_TOKEN=${token}`);
    writeFileSync(platformEnvPath, envText);
    console.info(`Updated MEDUSA_ADMIN_API_TOKEN in ${platformEnvPath}`);
  } else {
    appendFileSync(platformEnvPath, `\nMEDUSA_ADMIN_API_TOKEN=${token}\n`);
    console.info(`Appended MEDUSA_ADMIN_API_TOKEN to ${platformEnvPath}`);
  }
}

console.info(`
────────────────────────────────────────────────────────────
  Bootstrap ready

  MEDUSA_ADMIN_API_TOKEN=${token}

  Local:
    ${writeEnv ? "Token written to apps/platform-api/.env" : "Add the token to apps/platform-api/.env (or re-run with --write-env)"}
    Restart platform-api / run: MEDUSA_ADMIN_API_TOKEN=… pnpm dev:apps

  Production (Dokploy):
    1. Set MEDUSA_ADMIN_API_TOKEN in the compose environment
    2. Set MINIO_ROOT_PASSWORD (+ media DNS) if not already
    3. Redeploy / restart platform-api
    4. Do NOT run platform seed.ts / seed-demo on production
       unless you explicitly want a demo shop
────────────────────────────────────────────────────────────
`);
