import { loadServiceEnvFiles } from "@ecs/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadPlatformApiEnvFiles(moduleUrl = import.meta.url) {
  return loadServiceEnvFiles({
    serviceDir: getPlatformApiServiceDir(moduleUrl),
  });
}

export function getPlatformApiServiceDir(moduleUrl: string) {
  let currentDir = dirname(fileURLToPath(moduleUrl));

  while (!existsSync(resolve(currentDir, "package.json"))) {
    const parentDir = resolve(currentDir, "..");

    if (parentDir === currentDir) {
      return dirname(fileURLToPath(moduleUrl));
    }

    currentDir = parentDir;
  }

  return currentDir;
}
