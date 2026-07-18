import { loadServiceEnv } from "@ecs/config";
import { createPlatformDb } from "@ecs/db";
import { createJobsClient, startPlatformWorker, type JobHandler } from "@ecs/jobs";
import { createLogger } from "@ecs/logger";
import { createChapaPaymentService } from "./adapters/chapa/payment-service.js";
import { loadPlatformApiEnvFiles } from "./config/env.js";
import { createBillingLifecycleHandler } from "./jobs/handlers/billing-lifecycle.js";
import { createBillingPaymentReconcileHandler } from "./jobs/handlers/billing-payment-reconcile.js";
import { createNotificationsDeliverHandler } from "./jobs/handlers/notifications-deliver.js";
import { systemPingHandler } from "./jobs/handlers/system-ping.js";
import {
  parseBillingIntervalMs,
  registerBillingRepeatableJobs,
} from "./jobs/schedule-billing-jobs.js";
import {
  createResendEmailNotificationProvider,
  isEmailDeliveryConfigured,
} from "./modules/notifications/providers/email-provider.js";
import { createLogNotificationProvider } from "./modules/notifications/providers/log-provider.js";
import { createProviderRegistry } from "./modules/notifications/providers/registry.js";
import { createTelegramNotificationProvider } from "./modules/notifications/providers/telegram-provider.js";
import { createCodeNotificationRenderer } from "./modules/notifications/renderer.js";
import { createNotificationService } from "./modules/notifications/service.js";
import { resolveTelegramCallbackSecret } from "./modules/notifications/telegram-actions.js";
import { createTelegramOperatorService } from "./modules/notifications/telegram-operator.js";

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

const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
const emailFrom = process.env.EMAIL_FROM?.trim() || "";
const emailProvider = isEmailDeliveryConfigured(process.env)
  ? createResendEmailNotificationProvider({ apiKey: resendApiKey, from: emailFrom })
  : logProvider("email");

if (isEmailDeliveryConfigured(process.env)) {
  logger.info({ from: emailFrom }, "Email notification provider enabled (Resend)");
} else {
  logger.warn("RESEND_API_KEY/EMAIL_FROM not set; email deliveries use log provider");
}

const notificationProviders = createProviderRegistry([
  emailProvider,
  telegramProvider,
]);
const notificationRenderer = createCodeNotificationRenderer();

const jobsClient = createJobsClient({
  redisUrl,
  db: platformDb.db,
  logger,
});

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

const worker = startPlatformWorker({
  redisUrl,
  db: platformDb.db,
  handlers: {
    "system.ping": systemPingHandler as JobHandler,
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

logger.info(
  {
    handlers: [
      "system.ping",
      "notifications.deliver",
      "billing.lifecycle",
      "billing.reconcile-payments",
    ],
    schedule: "bullmq_repeatable",
  },
  "platform worker started",
);

async function shutdown(signal: string) {
  logger.info({ signal }, "platform worker shutting down");
  try {
    await jobsClient.close();
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
