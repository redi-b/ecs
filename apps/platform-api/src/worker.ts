import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb } from "@ecs/db";
import {
  createJobsClient,
  createShutdownController,
  type JobHandler,
  parseShutdownDeadlineMs,
  startPlatformWorkers,
} from "@ecs/jobs";
import { createLogger } from "@ecs/logger";
import { createChapaPaymentService } from "./adapters/chapa/payment-service.js";
import { createMediaStorageFromEnv } from "./adapters/storage/env.js";
import { createWorkerCommerceRuntime } from "./bootstrap/worker-commerce.js";
import { createWorkerNotificationRuntime } from "./bootstrap/worker-notifications.js";
import { startWorkerScheduling } from "./bootstrap/worker-scheduling.js";
import { loadPlatformApiEnvFiles } from "./config/env.js";
import { assertPlatformProductionEnvironment } from "./config/production-environment.js";
import { createAnalyticsCommerceRollupHandler } from "./jobs/handlers/analytics-commerce-rollup.js";
import { createBillingLifecycleHandler } from "./jobs/handlers/billing-lifecycle.js";
import { createBillingPaymentReconcileHandler } from "./jobs/handlers/billing-payment-reconcile.js";
import { createEmailDeliverHandler } from "./jobs/handlers/email-deliver.js";
import { createInAppNotificationMaterializeHandler } from "./jobs/handlers/in-app-notification-materialize.js";
import { createMediaProcessHandler } from "./jobs/handlers/media-process.js";
import { createNotificationsDeliverHandler } from "./jobs/handlers/notifications-deliver.js";
import {
  createProductImportApplyHandler,
  createProductImportApplyStore,
} from "./jobs/handlers/product-import-apply.js";
import { systemPingHandler } from "./jobs/handlers/system-ping.js";
import { platformJobRegistry } from "./jobs/registry.js";
import { createMediaService } from "./modules/media/index.js";

loadPlatformApiEnvFiles();

assertPlatformProductionEnvironment(process.env);

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
    process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5433/platform_db",
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});

const { createCapacityLimitedProduct, medusaInternalUrl, orderService, productService } =
  await createWorkerCommerceRuntime({
    db: platformDb.db,
    env: process.env,
    logger,
  });

const jobsClient = createJobsClient({
  redisUrl,
  db: platformDb.db,
  logger,
  registry: platformJobRegistry,
});
const {
  accountEmailProvider,
  dispatchCustomerOrderEmail,
  emailEncryptionKey,
  notificationProviders,
  notificationRenderer,
  notificationService,
  telegramCallbackSecret,
  telegramOperatorService,
} = createWorkerNotificationRuntime({
  db: platformDb.db,
  env: process.env,
  jobsClient,
  logger,
});

// Chapa verify for billing reconcile (same secret as HTTP API).
const chapaPaymentService = createChapaPaymentService({
  apiUrl: process.env.CHAPA_API_URL,
  secretKey: process.env.CHAPA_SECRET_KEY,
});

if (!process.env.CHAPA_SECRET_KEY?.trim()) {
  logger.warn(
    "CHAPA_SECRET_KEY not set; billing.reconcile-payments will not be able to verify charges",
  );
}

const workerBuildVersion = process.env.APP_VERSION ?? process.env.GIT_SHA ?? "development";
const worker = startPlatformWorkers({
  buildVersion: workerBuildVersion,
  concurrencyByQueue: {
    bulk: Number.parseInt(process.env.WORKER_BULK_CONCURRENCY ?? "2", 10),
    critical: Number.parseInt(process.env.WORKER_CRITICAL_CONCURRENCY ?? "8", 10),
    default: Number.parseInt(process.env.WORKER_DEFAULT_CONCURRENCY ?? "4", 10),
  },
  redisUrl,
  db: platformDb.db,
  registry: platformJobRegistry,
  handlers: {
    "system.ping": systemPingHandler as JobHandler,
    "email.deliver": createEmailDeliverHandler({
      db: platformDb.db,
      encryptionKey: emailEncryptionKey,
      provider: accountEmailProvider,
    }) as JobHandler,
    "notifications.in-app.materialize": createInAppNotificationMaterializeHandler({
      ...(dispatchCustomerOrderEmail ? { dispatchCustomerEmail: dispatchCustomerOrderEmail } : {}),
      inbox: notificationService.inbox,
    }) as JobHandler,
    "notifications.deliver": createNotificationsDeliverHandler({
      db: platformDb.db,
      renderer: notificationRenderer,
      providers: notificationProviders,
      ...(telegramOperatorService
        ? {
            telegramOrderActions: {
              secret: telegramCallbackSecret,
              isOperatorChat: async (input) => {
                const result = await telegramOperatorService.isOperatorChatForActions(input);
                return { allowed: result.allowed };
              },
            },
          }
        : {}),
    }) as JobHandler,
    "billing.lifecycle": createBillingLifecycleHandler({
      db: platformDb.db,
      recordNotificationEvent: notificationService.recordNotificationEvent,
    }) as JobHandler,
    "billing.reconcile-payments": createBillingPaymentReconcileHandler({
      db: platformDb.db,
      verifyPayment: (txRef) => chapaPaymentService.verifyPayment(txRef),
    }) as JobHandler,
    "analytics.commerce-rollup": createAnalyticsCommerceRollupHandler({
      db: platformDb.db,
      listOrders: (input) => orderService.listMerchantOrders(input),
      listProducts: (input) => productService.listMerchantProducts(input),
    }) as JobHandler,
    "media.process": createMediaProcessHandler({
      db: platformDb.db,
      storage: createMediaStorageFromEnv(),
      updateProductMediaVariants: (input) => productService.updateProductMediaVariants(input),
    }) as JobHandler,
    "product-import.apply": createProductImportApplyHandler({
      store: createProductImportApplyStore(platformDb.db),
      syncProductMedia: createMediaService(platformDb.db, createMediaStorageFromEnv(), {
        updateProductMediaVariants: productService.updateProductMediaVariants,
      }).syncProductMedia,
      commerce: {
        createProduct: createCapacityLimitedProduct,
        findImportedProduct: productService.findImportedProduct,
        updateProduct: productService.updateMerchantProduct,
        updateVariantStock: productService.updateMerchantProductVariantStock,
      },
    }) as JobHandler,
  },
  logger,
});

const scheduling = startWorkerScheduling({
  buildVersion: workerBuildVersion,
  env: process.env,
  jobsClient,
  logger,
  medusaInternalUrl,
  notificationService,
});

logger.info(
  {
    handlers: [
      "system.ping",
      "notifications.in-app.materialize",
      "notifications.deliver",
      "billing.lifecycle",
      "billing.reconcile-payments",
      "analytics.commerce-rollup",
    ],
    schedule: "bullmq_repeatable",
  },
  "platform worker started",
);

const shutdownController = createShutdownController({
  deadlineMs: parseShutdownDeadlineMs(process.env.WORKER_SHUTDOWN_DEADLINE_MS),
  force: () => worker.close(true),
  logger,
  steps: [
    {
      name: "scheduling",
      run: () => {
        scheduling.stop();
      },
    },
    { name: "worker", run: () => worker.close() },
    { name: "producers", run: () => jobsClient.close() },
    { name: "database", run: () => platformDb.pool.end() },
  ],
});

async function shutdown(signal: string) {
  try {
    const outcome = await shutdownController.request(signal);
    process.exit(outcome === "completed" ? 0 : 1);
  } catch (error) {
    logger.error({ err: error }, "Error during platform worker shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
