#!/usr/bin/env node
/**
 * Demo shops + catalog (local/staging only).
 *
 *   pnpm seed:demo
 *   pnpm seed:demo --clean
 *   pnpm seed:demo --strict
 *
 * Prerequisites: pnpm seed --write-env, Medusa + platform-api reachable for full catalog.
 */
import {
  blank,
  heading,
  info,
  kv,
  loadMedusaAdminTokenFromEnvFile,
  run,
  success,
  warn,
} from "./lib/cli.mjs";

const clean = process.argv.includes("--clean");
const strict = process.argv.includes("--strict");

loadMedusaAdminTokenFromEnvFile();

heading(clean ? "ECS demo seed · clean" : "ECS demo seed");
kv([
  ["Mode", clean ? "clean demo shops" : "create tech + fashion shops"],
  ["Strict", strict ? "fail if commerce incomplete" : "allow partial commerce"],
  [
    "Token",
    process.env.MEDUSA_ADMIN_API_TOKEN?.trim() ? "loaded" : "missing (catalog may skip)",
  ],
]);
blank();

if (!process.env.MEDUSA_ADMIN_API_TOKEN?.trim() && !clean) {
  warn("MEDUSA_ADMIN_API_TOKEN is not set. Run `pnpm seed --write-env` for commerce catalog.");
  blank();
}

const env = {
  ...process.env,
  SEED_DEMO_ALLOW_PARTIAL: strict ? "false" : (process.env.SEED_DEMO_ALLOW_PARTIAL ?? "true"),
};

const demoArgs = ["src/seeds/demo-seed.ts", ...(clean ? ["--clean"] : []), ...(strict ? ["--strict"] : [])];

info(clean ? "Removing demo shops…" : "Seeding demo shops (Addis Tech Hub + Bole Style)…");
run("pnpm", ["--filter", "@ecs/platform-api", "exec", "tsx", ...demoArgs], { env });

blank();
if (clean) {
  success("Demo data removed");
} else {
  success("Demo data ready");
  blank();
  kv([
    ["Tech shop", "http://addis-tech.lvh.me/admin"],
    ["", "owner@addis-tech.local / password1234"],
    ["Fashion shop", "http://bole-style.lvh.me/admin"],
    ["", "owner@bole-style.local / password1234"],
  ]);
  blank();
  info("If commerce was skipped, start Medusa and re-run: pnpm seed:demo");
}
blank();
