#!/usr/bin/env node
/**
 * Wipe local Docker volumes, recreate empty DBs, migrate.
 *
 *   pnpm db:reset
 *   pnpm db:reset --yes
 *
 * Then: pnpm seed --write-env
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { blank, heading, info, kv, run, success, warn } from "./lib/cli.mjs";

const composeFile = "infra/compose/docker-compose.yml";
const yes = process.argv.includes("--yes") || process.argv.includes("-y");

async function confirm() {
  if (yes) return true;
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "Delete local postgres/redis/minio volumes and recreate empty DBs? [y/N] ",
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

heading("ECS database reset");
kv([
  ["Compose file", composeFile],
  ["Confirm", yes ? "skipped (--yes)" : "interactive"],
]);
blank();

if (!(await confirm())) {
  warn("Aborted");
  process.exit(0);
}

info("Stopping compose stack and removing volumes…");
run("docker", ["compose", "-f", composeFile, "down", "-v", "--remove-orphans"]);
success("Volumes removed");

blank();
info("Starting infrastructure…");
run("pnpm", ["dev:infra"]);
success("Infrastructure is up");

blank();
info("Migrating platform database…");
run("pnpm", ["db:migrate"]);
success("Platform migrated");

info("Migrating Medusa database…");
run("pnpm", ["medusa:migrate"]);
success("Medusa migrated");

blank();
heading("Databases empty and migrated");
kv([
  ["Next", "pnpm seed --write-env"],
  ["Then", "pnpm dev:apps"],
  ["Demo", "pnpm seed:demo  (after apps are up)"],
]);
blank();
