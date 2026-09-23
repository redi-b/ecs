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
import { resolveMedusaAdminToken } from "./adapters/medusa/admin-token.js";
import { createMedusaOrderService } from "./adapters/medusa/order/service.js";
import { createMedusaProductService } from "./adapters/medusa/product/service.js";
import { createMediaStorageFromEnv } from "./adapters/storage/env.js";
import { loadPlatformApiEnvFiles } from "./config/env.js";
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
import {
  DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS,
  registerAnalyticsRepeatableJobs,
} from "./jobs/schedule-analytics-jobs.js";
import {
  parseBillingIntervalMs,
  registerBillingRepeatableJobs,
} from "./jobs/schedule-billing-jobs.js";
import { createProductCapacityWriter } from "./modules/billing/product-capacity.js";
import { createCustomerOrderEmailDispatcher } from "./modules/email/customer-order-dispatcher.js";
import { createEmailDeliveryService } from "./modules/email/delivery-service.js";
import { createMediaService } from "./modules/media/index.js";
import { createEmailNotificationProviderFromEnv } from "./modules/notifications/providers/email-provider-factory.js";
import { createLogNotificationProvider } from "./modules/notifications/providers/log-provider.js";
import { createProviderRegistry } from "./modules/notifications/providers/registry.js";
import { createTelegramNotificationProvider } from "./modules/notifications/providers/telegram-provider.js";
import { createCodeNotificationRenderer } from "./modules/notifications/renderer.js";
import { createNotificationService } from "./modules/notifications/service.js";
import { resolveTelegramCallbackSecret } from "./modules/telegram/telegram-actions.js";
import { createTelegramOperatorService } from "./modules/telegram/telegram-operator.js";
import { createResolveTenantIdByMedusaSalesChannel } from "./modules/tenants/resolve-by-medusa-sales-channel.js";

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
    process.env.PLATFORM_DATABASE_URL ?? "postgres://ecs:ecs@localhost:5433/platform_db",
  max: Number.parseInt(process.env.PLATFORM_DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: Number.parseInt(
    process.env.PLATFORM_DATABASE_POOL_IDLE_TIMEOUT_MS ?? "30000",
    10,
  ),
});

const medusaInternalUrl = process.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";
const medusaAdminToken = await resolveMedusaAdminToken({
  db: platformDb.db,
  envToken: process.env.MEDUSA_ADMIN_API_TOKEN,
  internalApiToken:
    process.env.PLATFORM_INTERNAL_API_TOKEN ??
    (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token"),
  logger,
  medusaInternalUrl,
});
if (!medusaAdminToken.ok) {
  logger.error({ error: medusaAdminToken.error }, "analytics rollup Medusa token unavailable");
  process.exit(1);
}
const orderService = createMedusaOrderService({
  adminApiToken: medusaAdminToken.token,
  medusaInternalUrl,
});
const productService = createMedusaProductService({
  adminApiToken: medusaAdminToken.token,
  medusaInternalUrl,
});
const resolveTenantIdBySalesChannel = createResolveTenantIdByMedusaSalesChannel(platformDb.db);
const createCapacityLimitedProduct = createProductCapacityWriter({
  createProduct: productService.createMerchantProduct,
  db: platformDb.db,
  listProducts: productService.listMerchantProducts,
  resolveTenantId: resolveTenantIdBySalesChannel,
});

const logProvider = (channel: string) =>
  createLogNotificationProvider(channel, {
    log: (fields, message) => {
      logger.info(fields, message);
    },
  });

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME?.trim() || "";
const telegramProvider = telegramBotToken
  ? createTelegramNotificationProvider({ botToken: telegramBotToken })
  : logProvider("telegram");

if (telegramBotToken) {
  logger.info("Telegram notification provider enabled");
} else {
  logger.warn("TELEGRAM_BOT_TOKEN not set; telegram deliveries use log provider");
}

const telegramOperatorService =
  telegramBotToken && telegramBotUsername
    ? createTelegramOperatorService(platformDb.db, {
        botToken: telegramBotToken,
        botUsername: telegramBotUsername,
      })
    : null;
const telegramCallbackSecret = resolveTelegramCallbackSecret();

const emailFrom = process.env.EMAIL_FROM?.trim() || "";
const emailProviderResolution = createEmailNotificationProviderFromEnv(process.env);
const emailProvider = emailProviderResolution.provider ?? logProvider("email");
const accountEmailProvider = emailProviderResolution.provider ?? {
  channel: "email" as const,
  async send() {
    throw new Error("email_provider_unavailable");
  },
};
const emailEncryptionKey =
  process.env.EMAIL_DELIVERY_ENCRYPTION_KEY?.trim() ||
  process.env.PLATFORM_SECRETS_ENCRYPTION_KEY?.trim() ||
  process.env.BETTER_AUTH_SECRET?.trim() ||
  "development-ecs-auth-secret-change-before-production";

if (emailProviderResolution.configured) {
  logger.info(
    { from: emailFrom, provider: emailProviderResolution.name },
    "Email notification provider enabled",
  );
} else {
  logger.warn("No email provider configured; email deliveries use the log provider");
}

const notificationProviders = createProviderRegistry([emailProvider, telegramProvider]);
const notificationRenderer = createCodeNotificationRenderer();

const jobsClient = createJobsClient({
  redisUrl,
  db: platformDb.db,
  logger,
  registry: platformJobRegistry,
});
const emailDeliveryService = emailProviderResolution.configured
  ? createEmailDeliveryService({
      db: platformDb.db,
      encryptionKey: emailEncryptionKey,
      enqueueJob: (input) => jobsClient.enqueueJob(input),
    })
  : null;
const dispatchCustomerOrderEmail = emailDeliveryService
  ? createCustomerOrderEmailDispatcher({
      db: platformDb.db,
      enqueueEmail: emailDeliveryService.enqueue,
    })
  : null;

const notificationService = createNotificationService(platformDb.db, {
  enqueueJob: (input) => jobsClient.enqueueJob(input),
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

void registerBillingRepeatableJobs({
  jobsClient,
  logger,
  reconcileIntervalMs: parseBillingIntervalMs(
    process.env.BILLING_RECONCILE_INTERVAL_MS,
    5 * 60 * 1000,
  ),
  lifecycleIntervalMs: parseBillingIntervalMs(
    process.env.BILLING_LIFECYCLE_INTERVAL_MS,
    60 * 60 * 1000,
  ),
}).catch((error) => {
  logger.warn(
    { err: error instanceof Error ? error.message : String(error) },
    "failed to register billing BullMQ repeatables",
  );
});

const analyticsStartupController = new AbortController();
const reconciliationIntervalMs = Math.max(
  5_000,
  Number.parseInt(process.env.JOB_RECONCILE_INTERVAL_MS ?? "30000", 10) || 30_000,
);
const recoverInboxEvents = async () => {
  const events = await notificationService.inbox.listRecoverableEvents(100);
  let queued = 0;
  let failed = 0;
  for (const event of events) {
    try {
      await jobsClient.enqueueJob({
        idempotencyKey: `notifications.in-app.materialize:${event.id}:${event.attempts}`,
        name: "notifications.in-app.materialize",
        payload: { eventId: event.id },
        tenantId: event.tenantId,
      });
      queued += 1;
    } catch {
      failed += 1;
    }
  }
  if (queued || failed) logger.info({ failed, queued }, "Inbox event recovery scan completed");
};
const reconcileQueued = () =>
  jobsClient.reconcileQueued().then(async (summary) => {
    await recoverInboxEvents();
    await jobsClient.recordSchedulerHeartbeat({
      buildVersion: workerBuildVersion,
      ttlMs: reconciliationIntervalMs * 3,
    });
    if (summary.recovered || summary.rejected) {
      logger.info(summary, "Queued job reconciliation completed");
    }
  });
void reconcileQueued().catch((error) => {
  logger.warn(
    { err: error instanceof Error ? error.message : String(error) },
    "Queued job reconciliation failed",
  );
});
const reconciliationTimer = setInterval(() => {
  void reconcileQueued().catch((error) => {
    logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "Queued job reconciliation failed",
    );
  });
}, reconciliationIntervalMs);
reconciliationTimer.unref();

const retentionIntervalMs = Math.max(
  60_000,
  Number.parseInt(process.env.JOB_RETENTION_INTERVAL_MS ?? "3600000", 10) || 3_600_000,
);
const cleanupExpiredRuns = () =>
  Promise.all([jobsClient.cleanupExpiredRuns(), notificationService.inbox.deleteExpired()]).then(
    ([jobs, inbox]) => {
      if (jobs.deleted) logger.info({ deleted: jobs.deleted }, "Expired job records removed");
      if (inbox.deleted) logger.info({ deleted: inbox.deleted }, "Expired inbox items removed");
    },
  );
void cleanupExpiredRuns().catch((error) => {
  logger.warn(
    { err: error instanceof Error ? error.message : String(error) },
    "Job record retention cleanup failed",
  );
});
const retentionTimer = setInterval(() => {
  void cleanupExpiredRuns().catch((error) => {
    logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "Job record retention cleanup failed",
    );
  });
}, retentionIntervalMs);
retentionTimer.unref();

void registerAnalyticsRepeatableJobs({
  jobsClient,
  isCommerceReady: async () => {
    const response = await fetch(new URL("/health", medusaInternalUrl), {
      signal: AbortSignal.timeout(1_000),
    }).catch(() => null);
    return response?.ok ?? false;
  },
  intervalMs: parseBillingIntervalMs(
    process.env.ANALYTICS_ROLLUP_INTERVAL_MS,
    DEFAULT_ANALYTICS_ROLLUP_INTERVAL_MS,
  ),
  signal: analyticsStartupController.signal,
}).catch((error) => {
  logger.warn(
    { err: error instanceof Error ? error.message : String(error) },
    "failed to register analytics BullMQ repeatable",
  );
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
        analyticsStartupController.abort();
        clearInterval(reconciliationTimer);
        clearInterval(retentionTimer);
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
