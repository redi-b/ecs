#!/usr/bin/env node
/**
 * Demo shops + catalog (local/staging only).
 *
 * Idempotent seed (safe to re-run):
 *   pnpm seed:demo
 *   pnpm seed:demo --strict
 *
 * Reverse / unseed (removes demo shops, users, catalog, metrics):
 *   pnpm seed:demo:clean
 *   pnpm seed:unseed
 *   pnpm seed:demo --clean
 *
 * Prerequisites: pnpm seed --write-env, Medusa reachable for full catalog.
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

const args = process.argv.slice(2);
const clean =
  args.includes("--clean") ||
  args.includes("--unseed") ||
  args.includes("--reverse") ||
  process.env.SEED_DEMO_MODE === "clean";
const strict = args.includes("--strict");

loadMedusaAdminTokenFromEnvFile();

heading(clean ? "ECS demo seed · reverse" : "ECS demo seed · idempotent");
kv([
  ["Mode", clean ? "remove demo shops + catalog" : "upsert tech + fashion shops"],
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

const demoArgs = [
  "src/seeds/demo-seed.ts",
  ...(clean ? ["--clean"] : []),
  ...(strict ? ["--strict"] : []),
];

info(
  clean
    ? "Reversing demo data (platform tenants + Medusa catalog)…"
    : "Seeding demo shops (safe re-run; refreshes catalog only)…",
);
run("pnpm", ["--filter", "@ecs/platform-api", "exec", "tsx", ...demoArgs], { env });

blank();
if (clean) {
  success("Demo data reversed");
  blank();
  kv([
    ["Removed", "addis-tech + bole-style shops, owners, catalog, metrics"],
    ["Kept", "bootstrap token, plans, non-demo tenants"],
  ]);
} else {
  success("Demo data ready");
  blank();
  kv([
    ["Tech shop", "http://addis-tech.lvh.me/admin"],
    ["", "owner@addis-tech.local / password1234"],
    ["Fashion shop", "http://bole-style.lvh.me/admin"],
    ["", "owner@bole-style.local / password1234"],
    ["Reverse", "pnpm seed:demo:clean"],
  ]);
  blank();
  info("Re-run anytime: pnpm seed:demo (idempotent refresh)");
}
blank();
