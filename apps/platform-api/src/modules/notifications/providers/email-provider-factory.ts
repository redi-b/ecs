import {
  resolveEmailSenderConfiguration,
  validateEmailSenderConfiguration,
} from "./email-configuration.js";
import {
  createResendEmailNotificationProvider,
  isEmailDeliveryConfigured,
} from "./email-provider.js";
import type { NotificationProvider } from "./types.js";

export type EmailProviderResolution = {
  configured: boolean;
  name: string | null;
  provider: NotificationProvider | null;
};

export type EmailProviderAdapter = {
  create(env: NodeJS.ProcessEnv): NotificationProvider;
  name: string;
  validate(env: NodeJS.ProcessEnv): string | null;
};

const resendAdapter: EmailProviderAdapter = {
  create(env) {
    return createResendEmailNotificationProvider({
      apiKey: env.RESEND_API_KEY ?? "",
      from: env.EMAIL_FROM ?? "",
      senders: resolveEmailSenderConfiguration(env),
    });
  },
  name: "resend",
  validate(env) {
    if (!env.RESEND_API_KEY?.trim()) return "EMAIL_PROVIDER=resend requires RESEND_API_KEY";
    return validateEmailSenderConfiguration({
      env,
      production: env.NODE_ENV === "production",
    });
  },
};

/**
 * Composition boundary for outbound email. Auth and notification delivery only
 * depend on NotificationProvider; vendor adapters are selected here.
 */
export function createEmailNotificationProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  adapters: readonly EmailProviderAdapter[] = [resendAdapter],
): EmailProviderResolution {
  const selected =
    env.EMAIL_PROVIDER?.trim().toLowerCase() || (isEmailDeliveryConfigured(env) ? "resend" : "");

  if (!selected) {
    return { configured: false, name: null, provider: null };
  }

  const adapter = adapters.find((candidate) => candidate.name === selected);
  if (!adapter) {
    throw new Error(`Unsupported EMAIL_PROVIDER: ${selected}`);
  }

  const configurationError = adapter.validate(env);
  if (configurationError) {
    throw new Error(configurationError);
  }

  return {
    configured: true,
    name: adapter.name,
    provider: adapter.create(env),
  };
}
