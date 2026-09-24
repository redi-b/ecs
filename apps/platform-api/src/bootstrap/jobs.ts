import type { createPlatformDb } from "@ecs/db";
import { createJobsClient } from "@ecs/jobs";
import type { createLogger } from "@ecs/logger";
import { platformJobRegistry } from "../jobs/registry.js";
import { createInsightsRefreshService } from "../modules/analytics/refresh-service.js";
import { createProductImportExecutionService } from "../modules/data-transfer/product-import-execution.js";
import { createNotificationService } from "../modules/notifications/service.js";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];
type PlatformLogger = ReturnType<typeof createLogger>;

type JobsBootstrapOptions = {
  db: PlatformDatabase;
  env: NodeJS.ProcessEnv;
  logger: PlatformLogger;
};

export function createJobsRuntime(options: JobsBootstrapOptions) {
  const redisUrl = options.env.REDIS_URL?.trim();
  const jobsClient = redisUrl
    ? createJobsClient({
        redisUrl,
        db: options.db,
        logger: options.logger,
        registry: platformJobRegistry,
      })
    : null;

  if (!jobsClient) {
    options.logger.warn("REDIS_URL is not set; background jobs will not be enqueued.");
  }

  const enqueueJob = jobsClient
    ? (input: Parameters<typeof jobsClient.enqueueJob>[0]) => jobsClient.enqueueJob(input)
    : undefined;

  return {
    enqueueJob,
    jobsClient,
    notificationService: createNotificationService(options.db, {
      ...(enqueueJob ? { enqueueJob } : {}),
    }),
    productImportExecutionService: enqueueJob
      ? createProductImportExecutionService(options.db, { enqueue: enqueueJob })
      : null,
    requestInsightsRefresh: enqueueJob ? createInsightsRefreshService({ enqueueJob }) : undefined,
  };
}
