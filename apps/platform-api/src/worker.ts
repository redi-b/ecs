import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb } from "@ecs/db";
import { startPlatformWorker, type JobHandler } from "@ecs/jobs";
import { createLogger } from "@ecs/logger";
import { loadPlatformApiEnvFiles } from "./config/env.js";
import { systemPingHandler } from "./jobs/handlers/system-ping.js";

loadPlatformApiEnvFiles();

const env = loadServiceEnv({
  ...process.env,
  SERVICE_NAME: process.env.SERVICE_NAME ?? "platform-worker",
});

const logger = createLogger({
  serviceName: env.SERVICE_NAME,
  environment: env.NODE_ENV,
});

const redisUrl = process.env.REDIS_URL?.trim();
if (!redisUrl) {
  logger.error("REDIS_URL is required for the platform worker");
  process.exit(1);
}

const platformDb = createPlatformDb({
  connectionString:
    process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5432/platform_db",
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});

const worker = startPlatformWorker({
  redisUrl,
  db: platformDb.db,
  handlers: {
    // Handlers receive unknown payload at the worker boundary; runtime validation is inside.
    "system.ping": systemPingHandler as JobHandler,
  },
  logger,
});

async function shutdown(signal: string) {
  logger.info({ signal }, "platform worker shutting down");
  try {
    await worker.close();
    await platformDb.pool.end();
  } catch (error) {
    logger.error({ err: error }, "error during platform worker shutdown");
    process.exit(1);
  }
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
