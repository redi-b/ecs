#!/usr/bin/env node
/**
 * Wipe local Docker volumes and recreate empty platform_db + medusa_db.
 * Does not seed. Use after this: pnpm seed:bootstrap
 *
 * Usage:
 *   pnpm db:reset:local
 *   pnpm db:reset:local --yes   # skip confirmation
 */
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const composeFile = "infra/compose/docker-compose.yml";
const yes = process.argv.includes("--yes") || process.argv.includes("-y");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function confirm() {
  if (yes) return true;
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "This deletes local postgres/redis/minio volumes. Continue? [y/N] ",
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

if (!(await confirm())) {
  console.info("Aborted.");
  process.exit(0);
}

console.info("→ Stopping compose and removing volumes…");
run("docker", ["compose", "-f", composeFile, "down", "-v", "--remove-orphans"]);

console.info("→ Starting infrastructure (postgres, redis, minio, caddy)…");
run("pnpm", ["dev:infra"]);

console.info("→ Running platform + Medusa migrations…");
run("pnpm", ["db:migrate"]);
run("pnpm", ["medusa:migrate"]);

console.info(`
Local databases are empty and migrated.

Next:
  1. pnpm seed:bootstrap
     → creates Medusa secret key, prints MEDUSA_ADMIN_API_TOKEN,
       syncs storefront templates

  2. Put the token in apps/platform-api/.env:
       MEDUSA_ADMIN_API_TOKEN=sk_…

  3. Start apps:
       MEDUSA_ADMIN_API_TOKEN=sk_… pnpm dev:apps

  4. Test real onboarding at http://dashboard.lvh.me/admin
     (sign up → create shop)

Optional demo shop (not production):
  pnpm seed
  MEDUSA_ADMIN_API_TOKEN=sk_… pnpm seed:demo
`);
