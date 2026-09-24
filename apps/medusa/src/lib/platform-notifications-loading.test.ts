import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const medusaRoot = resolve(__dirname, "../..");

test("platform notification helpers load in the Medusa CLI CommonJS runtime", () => {
  const result = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", "-e", "require('./src/lib/platform-notifications.ts')"],
    {
      cwd: medusaRoot,
      encoding: "utf8",
      env: { ...process.env, TS_NODE_PROJECT: "tsconfig.json" },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
