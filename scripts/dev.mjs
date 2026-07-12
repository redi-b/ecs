import { spawnSync } from "node:child_process";

const steps = [
  ["Starting local infrastructure", ["pnpm", "dev:infra"]],
  ["Running platform database migrations", ["pnpm", "db:migrate"]],
  ["Running Medusa migrations", ["pnpm", "medusa:migrate"]],
  // Bootstrap only (Medusa API token + templates). Demo catalog is opt-in: pnpm seed:demo
  ["Bootstrapping Medusa + templates", ["pnpm", "seed", "--write-env"]],
];

for (const [label, command] of steps) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\n==> Starting app development processes");
const result = spawnSync("pnpm", ["dev:apps", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 0);
