#!/usr/bin/env node
/**
 * Optional demo shops + catalog (local/staging only).
 *
 *   pnpm seed:demo           # create demo data
 *   pnpm seed:demo --clean   # remove demo data
 *   pnpm seed:demo --strict  # fail if Medusa commerce seed is skipped
 *
 * Prerequisites: `pnpm seed --write-env` (token + templates), Medusa running for full catalog.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const clean = process.argv.includes("--clean");
const strict = process.argv.includes("--strict");

function loadTokenFromEnvFile() {
  if (process.env.MEDUSA_ADMIN_API_TOKEN?.trim()) return;
  const path = resolve("apps/platform-api/.env");
  if (!existsSync(path)) return;
  const match = readFileSync(path, "utf8").match(/^MEDUSA_ADMIN_API_TOKEN=(.+)$/m);
  const value = match?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (value) process.env.MEDUSA_ADMIN_API_TOKEN = value;
}

function run(args) {
  const env = {
    ...process.env,
    // Soft-fail commerce when Medusa is down unless --strict
    SEED_DEMO_ALLOW_PARTIAL: strict ? "false" : (process.env.SEED_DEMO_ALLOW_PARTIAL ?? "true"),
  };
  const result = spawnSync("pnpm", ["--filter", "@ecs/platform-api", "exec", "tsx", ...args], {
    stdio: "inherit",
    env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

loadTokenFromEnvFile();

if (!process.env.MEDUSA_ADMIN_API_TOKEN?.trim() && !clean) {
  console.warn(
    "MEDUSA_ADMIN_API_TOKEN is not set. Run `pnpm seed --write-env` first for commerce catalog data.\n",
  );
}

if (clean) {
  console.info("→ Cleaning demo data");
  run(["src/seeds/demo-catalog.ts", "--clean"]);
  process.exit(0);
}

console.info("→ [1/2] Demo platform tenants");
run(["src/seeds/demo-tenant.ts"]);

console.info("→ [2/2] Demo commerce catalog (requires Medusa + token)");
run(["src/seeds/demo-catalog.ts"]);

console.info(`
Demo data ready.
  Shop:  http://selam.lvh.me/admin
  User:  owner@selam.local
  Pass:  password1234 (or SEED_OWNER_PASSWORD)

If commerce was skipped, start Medusa and re-run: pnpm seed:demo
`);
