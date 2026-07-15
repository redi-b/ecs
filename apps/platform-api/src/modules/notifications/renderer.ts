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

function pickScalar(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

/** Prefer merchant-facing display ids (#10) over Medusa resource ids. */
export function formatOrderRef(raw: string | undefined): string {
  if (!raw?.trim()) return "order";
  const value = raw.trim();
  if (value === "unknown") return "order";
  // Medusa order ids are not useful in merchant alerts.
  if (/^order_[a-zA-Z0-9]+$/i.test(value) || value.length > 24) {
    return "order";
  }
  if (value.startsWith("#")) return value;
  if (/^\d+$/.test(value)) return `#${value}`;
  return value;
}

/**
 * Normalize money for merchant-facing copy.
 * Handles raw decimals like "10880.000000000000" and optional currency codes.
 */
export function formatMoneyAmount(
  amountRaw: string | undefined,
  currencyRaw?: string | undefined,
): string | undefined {
  if (!amountRaw?.trim()) return undefined;
  const trimmed = amountRaw.trim();

  // Already looks human-formatted with a currency word/symbol mixed in.
  if (/[a-zA-Z]/.test(trimmed) && !/^\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  const numeric = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return trimmed;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);

  const currency = currencyRaw?.trim().toUpperCase();
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    return `${currency} ${formatted}`;
  }
  return formatted;
}

function lines(...parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n");
}

/**
 * Code-side templates. Swap for DB/i18n/HTML packs later via the same interface.
 * Copy is merchant-facing: short titles, readable money, no internal channel jargon.
 */
export function createCodeNotificationRenderer(): NotificationRenderer {
  return {
    render(input: RenderNotificationInput): RenderNotificationResult {
      const data = asRecord(input.payload);
      const orderRef = formatOrderRef(
        pickScalar(data, "orderDisplayId", "displayId", "orderId", "txRef"),
      );
      const amount = formatMoneyAmount(
        pickScalar(data, "amount", "total", "totalAmount"),
        pickScalar(data, "currencyCode", "currency", "currency_code"),
      );
      const shop = pickScalar(data, "shopName", "tenantName");

      // Email + in-app use subject as the short title; chat channels use body only.
      const subjectFor = (title: string) =>
        input.channel === "email" || input.channel === "in_app" ? title : undefined;

      const withSubject = (title: string, body: string): RenderNotificationResult => {
        const result: RenderNotificationResult = { body };
        const subject = subjectFor(title);
        if (subject !== undefined) {
          result.subject = subject;
        }
        return result;
      };

      switch (input.eventType) {
        case "notification.test": {
          return withSubject(
            "Test notification",
            lines(
              "This is a test alert from your shop.",
              shop ? `Shop: ${shop}` : null,
              "If you received this, notifications are working.",
            ),
          );
        }
        case "cod_order.created":
        case "order.created": {
          const title =
            orderRef === "order" ? "New order" : `New order ${orderRef}`;
          return withSubject(
            title,
            lines(
              orderRef === "order" ? "You received a new order." : `You received order ${orderRef}.`,
              amount ? `Total: ${amount}` : null,
              shop ? `Shop: ${shop}` : null,
            ),
          );
        }
        case "order.cancelled": {
          const title =
            orderRef === "order" ? "Order cancelled" : `Order ${orderRef} cancelled`;
          return withSubject(
            title,
            lines(
              orderRef === "order"
                ? "An order was cancelled."
                : `Order ${orderRef} was cancelled.`,
              amount ? `Total: ${amount}` : null,
              shop ? `Shop: ${shop}` : null,
            ),
          );
        }
        case "payment.paid":
        case "payment.failed": {
          const paid = input.eventType === "payment.paid";
          const titleBase = paid ? "Payment received" : "Payment failed";
          const title =
            orderRef === "order" ? titleBase : `${titleBase} · ${orderRef}`;
          return withSubject(
            title,
            lines(
              orderRef === "order"
                ? paid
                  ? "A payment was received."
                  : "A payment failed."
                : paid
                  ? `Payment received for order ${orderRef}.`
                  : `Payment failed for order ${orderRef}.`,
              amount ? `Amount: ${amount}` : null,
              shop ? `Shop: ${shop}` : null,
            ),
          );
        }
        default: {
          const title = "Shop update";
          return withSubject(
            title,
            lines(
              "Something updated in your shop.",
              orderRef !== "order" ? `Reference: ${orderRef}` : null,
            ),
          );
        }
      }
    },
  };
}
