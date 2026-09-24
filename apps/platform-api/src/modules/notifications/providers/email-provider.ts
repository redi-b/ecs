import type { EmailSenderConfiguration } from "./email-configuration.js";
import type {
  NotificationProvider,
  SendNotificationInput,
  SendNotificationResult,
} from "./types.js";

export type CreateResendEmailProviderOptions = {
  apiKey: string;
  /** Verified sender, e.g. `Shop Alerts <alerts@example.com>` or `alerts@example.com`. */
  from: string;
  senders?: EmailSenderConfiguration;
  /** Optional fetch override for tests. */
  fetchImpl?: typeof fetch;
};

const resendTagPartPattern = /[^A-Za-z0-9_-]+/g;

/** Resend only accepts ASCII letters, numbers, underscores, and dashes in tags. */
export function normalizeResendTags(tags: Record<string, string> | undefined) {
  if (!tags) return undefined;

  const normalized = Object.entries(tags).flatMap(([name, value]) => {
    const normalizedName = normalizeResendTagPart(name);
    const normalizedValue = normalizeResendTagPart(value);
    return normalizedName && normalizedValue
      ? [{ name: normalizedName, value: normalizedValue }]
      : [];
  });

  return normalized.length ? normalized : undefined;
}

function normalizeResendTagPart(value: string) {
  return value
    .trim()
    .replace(resendTagPartPattern, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 256);
}

/**
 * Real email delivery via Resend HTTP API.
 * recipient = mailbox address.
 */
export function createResendEmailNotificationProvider(
  options: CreateResendEmailProviderOptions,
): NotificationProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const from = options.from.trim();

  return {
    channel: "email",
    async send(input: SendNotificationInput): Promise<SendNotificationResult> {
      if (!apiKey) {
        throw new Error("email_api_key_missing");
      }
      const selectedFrom = input.senderProfile
        ? options.senders?.profiles[input.senderProfile]
        : options.senders?.profiles.notifications;
      const messageFrom = selectedFrom ?? from;
      if (!messageFrom) {
        throw new Error("email_from_missing");
      }

      const to = input.recipient.trim();
      if (!to) {
        throw new Error("email_recipient_missing");
      }

      const subject = (input.subject?.trim() || "Shop notification").slice(0, 200);
      const text = input.body.slice(0, 100_000);
      // The template renderer owns presentation. A transport adapter must send
      // the rendered document unchanged so every provider behaves identically.
      const html = input.html?.trim().slice(0, 100_000) || undefined;
      const tags = normalizeResendTags(input.tags);

      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: messageFrom,
          to: [to],
          subject,
          text,
          ...(html ? { html } : {}),
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
          ...(tags ? { tags } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await response.json().catch(() => null)) as {
        id?: string;
        message?: string;
        name?: string;
      } | null;

      if (!response.ok) {
        const detail =
          (typeof data?.message === "string" && data.message) ||
          (typeof data?.name === "string" && data.name) ||
          `email_http_${response.status}`;
        throw new Error(detail);
      }

      return {
        providerReference: data?.id ? `resend:${data.id}` : `resend:${to}`,
      };
    },
  };
}

export function isEmailDeliveryConfigured(
  env: {
    RESEND_API_KEY?: string | undefined;
    EMAIL_FROM?: string | undefined;
    EMAIL_FROM_ACCOUNTS?: string | undefined;
    EMAIL_FROM_BILLING?: string | undefined;
    EMAIL_FROM_NOTIFICATIONS?: string | undefined;
    EMAIL_FROM_ORDERS?: string | undefined;
  } = process.env,
): boolean {
  return Boolean(
    env.RESEND_API_KEY?.trim() &&
      (env.EMAIL_FROM?.trim() ||
        env.EMAIL_FROM_ACCOUNTS?.trim() ||
        env.EMAIL_FROM_BILLING?.trim() ||
        env.EMAIL_FROM_NOTIFICATIONS?.trim() ||
        env.EMAIL_FROM_ORDERS?.trim()),
  );
}
