import type { NotificationChannelId } from "./providers/types.js";

export type RenderNotificationInput = {
  channel: NotificationChannelId;
  eventType: string;
  tenantId: string;
  payload: unknown;
  recipient: string;
};

export type RenderNotificationResult = {
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export interface NotificationRenderer {
  render(input: RenderNotificationInput): RenderNotificationResult | Promise<RenderNotificationResult>;
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Code-side templates. Swap for DB/i18n/HTML packs later via the same interface.
 */
export function createCodeNotificationRenderer(): NotificationRenderer {
  return {
    render(input: RenderNotificationInput): RenderNotificationResult {
      const data = asRecord(input.payload);
      const orderRef =
        pickString(data, "orderDisplayId", "orderId", "displayId", "txRef") ?? "unknown";
      const amount = pickString(data, "amount", "total", "totalAmount");
      const shop = pickString(data, "shopName", "tenantName");

      // Email + in-app use subject as the short title; chat channels use body only.
      const subjectFor = (title: string) =>
        input.channel === "email" || input.channel === "in_app" ? title : undefined;

      switch (input.eventType) {
        case "notification.test": {
          const body = [
            "This is a test notification from your shop platform.",
            shop ? `Shop: ${shop}` : null,
            input.channel !== "in_app" ? `Channel: ${input.channel}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          const result: RenderNotificationResult = { body };
          const subject = subjectFor("Test notification");
          if (subject !== undefined) {
            result.subject = subject;
          }
          return result;
        }
        case "cod_order.created":
        case "order.created": {
          const body = [
            `New order ${orderRef}`,
            amount ? `Total: ${amount}` : null,
            shop ? `Shop: ${shop}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          const result: RenderNotificationResult = { body };
          const subject = subjectFor(`New order ${orderRef}`);
          if (subject !== undefined) {
            result.subject = subject;
          }
          return result;
        }
        case "order.cancelled": {
          const body = [
            `Order ${orderRef} was cancelled`,
            amount ? `Total: ${amount}` : null,
            shop ? `Shop: ${shop}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          const result: RenderNotificationResult = { body };
          const subject = subjectFor(`Order cancelled ${orderRef}`);
          if (subject !== undefined) {
            result.subject = subject;
          }
          return result;
        }
        case "payment.paid":
        case "payment.failed": {
          const label = input.eventType === "payment.paid" ? "Payment received" : "Payment failed";
          const body = [
            `${label} for ${orderRef}`,
            amount ? `Amount: ${amount}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          const result: RenderNotificationResult = { body };
          const subject = subjectFor(`${label} ${orderRef}`);
          if (subject !== undefined) {
            result.subject = subject;
          }
          return result;
        }
        default: {
          const body = [
            `Event: ${input.eventType}`,
            orderRef !== "unknown" ? `Reference: ${orderRef}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          const result: RenderNotificationResult = { body };
          const subject = subjectFor(`Notification: ${input.eventType}`);
          if (subject !== undefined) {
            result.subject = subject;
          }
          return result;
        }
      }
    },
  };
}
