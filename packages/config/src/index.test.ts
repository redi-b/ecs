import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { loadServiceEnvFiles } from "./index.js";

describe("loadServiceEnvFiles", () => {
  it("loads root and service env files without overriding existing environment values", () => {
    const previousRootValue = process.env.ECS_CONFIG_ROOT_VALUE;
    const previousServiceValue = process.env.ECS_CONFIG_SERVICE_VALUE;
    const previousExistingValue = process.env.ECS_CONFIG_EXISTING_VALUE;
    const root = mkdtempSync(join(tmpdir(), "ecs-config-"));
    const serviceDir = join(root, "service");

    try {
      mkdirSync(serviceDir);
      writeFileSync(join(root, ".env"), "ECS_CONFIG_ROOT_VALUE=root\nECS_CONFIG_EXISTING_VALUE=root\n");
      writeFileSync(
        join(serviceDir, ".env"),
        "ECS_CONFIG_SERVICE_VALUE=service\nECS_CONFIG_EXISTING_VALUE=service\n",
      );
      process.env.ECS_CONFIG_EXISTING_VALUE = "existing";
      delete process.env.ECS_CONFIG_ROOT_VALUE;
      delete process.env.ECS_CONFIG_SERVICE_VALUE;

      const loaded = loadServiceEnvFiles({ cwd: root, serviceDir });

      assert.deepEqual(loaded, [join(root, ".env"), join(serviceDir, ".env")]);
      assert.equal(process.env.ECS_CONFIG_ROOT_VALUE, "root");
      assert.equal(process.env.ECS_CONFIG_SERVICE_VALUE, "service");
      assert.equal(process.env.ECS_CONFIG_EXISTING_VALUE, "existing");
    } finally {
      restoreEnv("ECS_CONFIG_ROOT_VALUE", previousRootValue);
      restoreEnv("ECS_CONFIG_SERVICE_VALUE", previousServiceValue);
      restoreEnv("ECS_CONFIG_EXISTING_VALUE", previousExistingValue);
      rmSync(root, { force: true, recursive: true });
    }
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
