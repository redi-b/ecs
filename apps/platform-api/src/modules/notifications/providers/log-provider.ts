import type { NotificationChannelId, NotificationProvider, SendNotificationInput } from "./types.js";

/**
 * Dev-safe provider: records a structured log and returns a reference.
 * Real channels replace this at composition time without changing the job path.
 */
export function createLogNotificationProvider(
  channel: NotificationChannelId,
  options?: {
    log?: (fields: Record<string, unknown>, message: string) => void;
  },
): NotificationProvider {
  const log = options?.log ?? (() => undefined);

  return {
    channel,
    async send(input: SendNotificationInput) {
      const providerReference = `log:${channel}:${crypto.randomUUID()}`;
      log(
        {
          channel: input.channel,
          tenantId: input.tenantId,
          recipient: input.recipient,
          eventType: input.eventType,
          subject: input.subject,
          bodyPreview: input.body.slice(0, 200),
          providerReference,
        },
        "notification.delivered_via_log_provider",
      );
      return { providerReference };
    },
  };
}
