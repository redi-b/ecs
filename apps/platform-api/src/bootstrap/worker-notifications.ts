import type { createPlatformDb } from "@ecs/db";
import type { createJobsClient } from "@ecs/jobs";
import type { createLogger } from "@ecs/logger";
import { createCustomerOrderEmailDispatcher } from "../modules/email/customer-order-dispatcher.js";
import { createEmailDeliveryService } from "../modules/email/delivery-service.js";
import { createEmailNotificationProviderFromEnv } from "../modules/notifications/providers/email-provider-factory.js";
import { createLogNotificationProvider } from "../modules/notifications/providers/log-provider.js";
import { createProviderRegistry } from "../modules/notifications/providers/registry.js";
import { createTelegramNotificationProvider } from "../modules/notifications/providers/telegram-provider.js";
import { createCodeNotificationRenderer } from "../modules/notifications/renderer.js";
import { createNotificationService } from "../modules/notifications/service.js";
import { resolveTelegramCallbackSecret } from "../modules/telegram/telegram-actions.js";
import { createTelegramOperatorService } from "../modules/telegram/telegram-operator.js";

type WorkerNotificationRuntimeOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
  jobsClient: ReturnType<typeof createJobsClient>;
  logger: ReturnType<typeof createLogger>;
};

export function createWorkerNotificationRuntime(options: WorkerNotificationRuntimeOptions) {
  const logProvider = (channel: string) =>
    createLogNotificationProvider(channel, {
      log: (fields, message) => options.logger.info(fields, message),
    });

  const telegramBotToken = options.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const telegramBotUsername = options.env.TELEGRAM_BOT_USERNAME?.trim() || "";
  const telegramProvider = telegramBotToken
    ? createTelegramNotificationProvider({ botToken: telegramBotToken })
    : logProvider("telegram");

  if (telegramBotToken) {
    options.logger.info("Telegram notification provider enabled");
  } else {
    options.logger.warn("TELEGRAM_BOT_TOKEN not set; telegram deliveries use log provider");
  }

  const telegramOperatorService =
    telegramBotToken && telegramBotUsername
      ? createTelegramOperatorService(options.db, {
          botToken: telegramBotToken,
          botUsername: telegramBotUsername,
        })
      : null;

  const emailFrom = options.env.EMAIL_FROM?.trim() || "";
  const emailProviderResolution = createEmailNotificationProviderFromEnv(options.env);
  const emailProvider = emailProviderResolution.provider ?? logProvider("email");
  const accountEmailProvider = emailProviderResolution.provider ?? {
    channel: "email" as const,
    async send() {
      throw new Error("email_provider_unavailable");
    },
  };
  const emailEncryptionKey =
    options.env.EMAIL_DELIVERY_ENCRYPTION_KEY?.trim() ||
    options.env.PLATFORM_SECRETS_ENCRYPTION_KEY?.trim() ||
    options.env.BETTER_AUTH_SECRET?.trim() ||
    "development-ecs-auth-secret-change-before-production";

  if (emailProviderResolution.configured) {
    options.logger.info(
      { from: emailFrom, provider: emailProviderResolution.name },
      "Email notification provider enabled",
    );
  } else {
    options.logger.warn("No email provider configured; email deliveries use the log provider");
  }

  const emailDeliveryService = emailProviderResolution.configured
    ? createEmailDeliveryService({
        db: options.db,
        encryptionKey: emailEncryptionKey,
        enqueueJob: (input) => options.jobsClient.enqueueJob(input),
      })
    : null;

  return {
    accountEmailProvider,
    dispatchCustomerOrderEmail: emailDeliveryService
      ? createCustomerOrderEmailDispatcher({
          db: options.db,
          enqueueEmail: emailDeliveryService.enqueue,
        })
      : null,
    emailEncryptionKey,
    notificationProviders: createProviderRegistry([emailProvider, telegramProvider]),
    notificationRenderer: createCodeNotificationRenderer(),
    notificationService: createNotificationService(options.db, {
      enqueueJob: (input) => options.jobsClient.enqueueJob(input),
    }),
    telegramCallbackSecret: resolveTelegramCallbackSecret(),
    telegramOperatorService,
  };
}
