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

function dockerPsql(args) {
  return spawnSync(
    "docker",
    ["compose", "-f", composeFile, "exec", "-T", "postgres", "psql", "-U", "ecs", ...args],
    { encoding: "utf8" },
  );
}

/** initdb only runs on empty volume; re-assert DBs in case entrypoint skipped them. */
function ensureDatabases() {
  for (const dbName of ["platform_db", "medusa_db"]) {
    const check = dockerPsql([
      "-d",
      "postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`,
    ]);
    if (check.status !== 0) {
      warn(`Could not query postgres for ${dbName} (status ${check.status}).`);
      continue;
    }
    if (String(check.stdout ?? "").trim() === "1") continue;

    info(`Creating database ${dbName}…`);
    const created = dockerPsql(["-d", "postgres", "-c", `CREATE DATABASE ${dbName};`]);
    if (created.status !== 0) {
      warn(`CREATE DATABASE ${dbName} failed: ${created.stderr || created.stdout || ""}`);
    }
  }
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
info("Ensuring platform_db and medusa_db exist…");
ensureDatabases();
success("Databases ready");

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
