import type { createPlatformDb } from "@ecs/db";
import type { createJobsClient } from "@ecs/jobs";
import type { createLogger } from "@ecs/logger";
import { createEmailDeliveryService } from "../modules/email/delivery-service.js";
import { createEmailTemplateService } from "../modules/email/template-service.js";
import { createEmailNotificationProviderFromEnv } from "../modules/notifications/providers/email-provider-factory.js";

type EmailBootstrapOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  enqueueJob?: ReturnType<typeof createJobsClient>["enqueueJob"] | undefined;
  env: NodeJS.ProcessEnv;
  logger: ReturnType<typeof createLogger>;
  telegramConfigured: boolean;
};

export function createEmailRuntime(options: EmailBootstrapOptions) {
  const resolution = createEmailNotificationProviderFromEnv(options.env);
  const emailDeliveryConfigured = resolution.configured;
  const requireEmailVerification = options.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";
  const emailProvider = resolution.provider;
  const encryptionKey =
    options.env.EMAIL_DELIVERY_ENCRYPTION_KEY?.trim() ||
    options.env.PLATFORM_SECRETS_ENCRYPTION_KEY?.trim() ||
    options.env.BETTER_AUTH_SECRET?.trim() ||
    "development-ecs-auth-secret-change-before-production";
  const emailDeliveryService =
    options.enqueueJob && emailProvider
      ? createEmailDeliveryService({
          db: options.db,
          encryptionKey,
          enqueueJob: options.enqueueJob,
        })
      : null;

  if (requireEmailVerification && !emailDeliveryService) {
    throw new Error(
      "AUTH_REQUIRE_EMAIL_VERIFICATION requires EMAIL_PROVIDER and REDIS_URL for durable delivery",
    );
  }
  if (emailDeliveryConfigured) {
    options.logger.info(
      { from: options.env.EMAIL_FROM?.trim(), provider: resolution.name },
      "Email delivery configured.",
    );
  } else {
    options.logger.warn(
      "No email provider configured; email delivery stays unavailable in the dashboard.",
    );
  }

  const emailTemplateService = createEmailTemplateService({ db: options.db, emailProvider });
  const notificationChannelAvailability = {
    email: emailDeliveryConfigured,
    telegram: options.telegramConfigured,
  };

  return {
    appOptions: {
      emailDeliveryConfigured,
      listEmailTemplates: emailTemplateService.list,
      getEmailTemplate: emailTemplateService.get,
      saveEmailTemplateDraft: emailTemplateService.saveDraft,
      publishEmailTemplate: emailTemplateService.publish,
      restoreEmailTemplateVersion: emailTemplateService.restore,
      previewEmailTemplate: emailTemplateService.preview,
      sendEmailTemplateTest: emailTemplateService.sendTest,
      notificationChannelAvailability,
    },
    emailDeliveryService,
    emailProvider,
    requireEmailVerification,
  };
}
