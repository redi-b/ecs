import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb } from "@ecs/db";

import { loadPlatformApiEnvFiles } from "./config/env.js";
import { syncStorefrontTemplateRegistry } from "./modules/storefront/template-registry-sync.js";

loadPlatformApiEnvFiles();

loadServiceEnv({
  ...process.env,
  SERVICE_NAME: process.env.SERVICE_NAME ?? "platform-api",
});
const platformDb = createPlatformDb({
  connectionString:
    process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db",
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});

try {
  const templateCount = await syncStorefrontTemplateRegistry(platformDb.db);
  console.info(
    `Synchronized ${templateCount} built-in storefront template${templateCount === 1 ? "" : "s"}.`,
  );
} finally {
  await platformDb.pool.end();
}
