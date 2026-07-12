#!/usr/bin/env node
/**
 * Wipe local Docker volumes, recreate empty DBs, migrate.
 *
 *   pnpm db:reset
 *   pnpm db:reset --yes
 *
 * Then: pnpm seed --write-env
 */
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const composeFile = "infra/compose/docker-compose.yml";
const yes = process.argv.includes("--yes") || process.argv.includes("-y");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function confirm() {
  if (yes) return true;
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "Delete local postgres/redis/minio volumes and recreate empty DBs? [y/N] ",
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

if (!(await confirm())) {
  console.info("Aborted.");
  process.exit(0);
}

console.info("→ docker compose down -v");
run("docker", ["compose", "-f", composeFile, "down", "-v", "--remove-orphans"]);

console.info("→ start infrastructure");
run("pnpm", ["dev:infra"]);

console.info("→ migrate platform + medusa");
run("pnpm", ["db:migrate"]);
run("pnpm", ["medusa:migrate"]);

console.info(`
Databases are empty and migrated.

Next:
  pnpm seed --write-env
  pnpm dev:apps

Optional demo catalog:
  pnpm seed:demo
`);
