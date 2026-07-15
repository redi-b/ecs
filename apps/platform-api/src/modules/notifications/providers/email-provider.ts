import type { NotificationProvider, SendNotificationInput, SendNotificationResult } from "./types.js";

export type CreateResendEmailProviderOptions = {
  apiKey: string;
  /** Verified sender, e.g. `Shop Alerts <alerts@example.com>` or `alerts@example.com`. */
  from: string;
  /** Optional fetch override for tests. */
  fetchImpl?: typeof fetch;
};

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
      if (!from) {
        throw new Error("email_from_missing");
      }

      const to = input.recipient.trim();
      if (!to) {
        throw new Error("email_recipient_missing");
      }

      const subject = (input.subject?.trim() || "Shop notification").slice(0, 200);
      const text = input.body.slice(0, 100_000);

      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
        }),
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

export function isEmailDeliveryConfigured(env: {
  RESEND_API_KEY?: string | undefined;
  EMAIL_FROM?: string | undefined;
} = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}
