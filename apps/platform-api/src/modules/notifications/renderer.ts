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
  /** Always plain text (in-app body, email text part, logs). */
  body: string;
  /**
   * Optional HTML for channels that support rich formatting.
   * Uses a Telegram-safe subset: <b>, newlines (email providers convert as needed).
   */
  html?: string;
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

/**
 * Shop-friendly order code for merchants.
 * Prefer short codes derived from Medusa `order_…` ids (last 6 chars).
 * Avoid sequential global display_id numbers — those increment across the shared DB.
 */
export function formatOrderRef(raw: string | undefined): string {
  if (!raw?.trim()) return "order";
  const value = raw.trim();
  if (value === "unknown") return "order";

  // Medusa resource id → short shop code (matches dashboard formatOrderReference).
  if (/^order_[a-zA-Z0-9]+$/i.test(value)) {
    const tail = value.replace(/^order_/i, "").slice(-6).toUpperCase();
    return tail || "order";
  }

  // Explicit short codes (already formatted).
  if (/^[A-Z0-9]{4,10}$/i.test(value) && !/^\d+$/.test(value)) {
    return value.toUpperCase();
  }

  // Legacy numeric display ids — still show as #N for already-queued events.
  if (value.startsWith("#")) return value;
  if (/^\d+$/.test(value)) return `#${value}`;

  // Long opaque strings (payment refs, etc.) are not merchant-friendly.
  if (value.length > 16) return "order";
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

function humanizeToken(value: string): string {
  const key = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  const map: Record<string, string> = {
    cod: "Cash on delivery",
    chapa: "Chapa",
    delivery: "Delivery",
    pickup: "Pickup",
    cash: "Cash",
    card: "Card",
    captured: "Paid",
    awaiting: "Awaiting payment",
    "not paid": "Unpaid",
    canceled: "Cancelled",
    cancelled: "Cancelled",
    pending: "Pending",
    success: "Successful",
    failed: "Failed",
    "dashboard mark paid": "Marked paid in dashboard",
    "dashboard finish mark paid": "Marked paid when finishing order",
    "dashboard test": "Dashboard test",
  };
  if (map[key]) return map[key];
  return key.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWhen(iso?: string): string | undefined {
  if (!iso?.trim()) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type Detail = { label: string; value: string };

function cleanDetails(details: Detail[]): Detail[] {
  return details.filter((d) => d.label.trim() && d.value.trim());
}

function composePlain(headline: string, details: Detail[], footer?: string | null): string {
  const rows = cleanDetails(details).map((d) => `${d.label}: ${d.value.trim()}`);
  const parts = [headline.trim(), ...rows];
  if (footer?.trim()) {
    parts.push("", footer.trim());
  }
  return parts.join("\n");
}

/**
 * Telegram-safe HTML (bold labels/headline + newlines).
 * Email providers map this to a simple HTML body with <br> breaks.
 */
function composeHtml(headline: string, details: Detail[], footer?: string | null): string {
  const lines = [`<b>${escapeHtml(headline.trim())}</b>`];
  for (const detail of cleanDetails(details)) {
    lines.push(
      `<b>${escapeHtml(detail.label)}:</b> ${escapeHtml(detail.value.trim())}`,
    );
  }
  if (footer?.trim()) {
    lines.push("", escapeHtml(footer.trim()));
  }
  return lines.join("\n");
}

function composeMessage(
  headline: string,
  details: Detail[],
  footer?: string | null,
): { body: string; html: string } {
  return {
    body: composePlain(headline, details, footer),
    html: composeHtml(headline, details, footer),
  };
}

type Context = {
  orderRef: string;
  amount?: string | undefined;
  shop?: string | undefined;
  customerName?: string | undefined;
  customerPhone?: string | undefined;
  customerEmail?: string | undefined;
  customerCity?: string | undefined;
  paymentMethod?: string | undefined;
  paymentStatus?: string | undefined;
  deliveryChoice?: string | undefined;
  itemCount?: string | undefined;
  txRef?: string | undefined;
  source?: string | undefined;
  when?: string | undefined;
};

function buildContext(data: Record<string, unknown>): Context {
  // Prefer Medusa order id → shop code. Fall back to orderCode, then legacy display id.
  const orderRef = formatOrderRef(
    pickScalar(data, "orderId", "order_id", "orderCode", "orderDisplayId", "displayId"),
  );
  const amount = formatMoneyAmount(
    pickScalar(data, "amount", "total", "totalAmount"),
    pickScalar(data, "currencyCode", "currency", "currency_code"),
  );
  const itemCountRaw = pickScalar(data, "itemCount", "itemsCount", "lineItemCount");
  return {
    orderRef,
    amount,
    shop: pickScalar(data, "shopName", "tenantName"),
    customerName: pickScalar(data, "customerName", "customer_name"),
    customerPhone: pickScalar(data, "customerPhone", "customer_phone", "phone"),
    customerEmail: pickScalar(data, "customerEmail", "customer_email", "email"),
    customerCity: pickScalar(data, "customerCity", "city"),
    paymentMethod: pickScalar(data, "paymentMethod", "payment_method"),
    paymentStatus: pickScalar(data, "paymentStatus", "payment_status", "status"),
    deliveryChoice: pickScalar(data, "deliveryChoice", "delivery_choice"),
    itemCount: itemCountRaw,
    // Keep raw payment refs out of merchant-facing copy (ugly provider/tx strings).
    txRef: undefined,
    source: pickScalar(data, "source", "paid_via"),
    when: formatWhen(pickScalar(data, "sentAt", "paidAt", "createdAt", "occurredAt")),
  };
}

function orderDetails(ctx: Context, options?: { includePaymentStatus?: boolean }): Detail[] {
  const details: Detail[] = [];
  if (ctx.orderRef !== "order") {
    details.push({ label: "Order", value: ctx.orderRef });
  }
  if (ctx.amount) {
    details.push({ label: "Total", value: ctx.amount });
  }
  if (ctx.itemCount) {
    const n = Number(ctx.itemCount);
    details.push({
      label: "Items",
      value: Number.isFinite(n) ? (n === 1 ? "1 item" : `${n} items`) : ctx.itemCount,
    });
  }
  if (ctx.customerName) {
    details.push({ label: "Customer", value: ctx.customerName });
  }
  if (ctx.customerPhone) {
    details.push({ label: "Phone", value: ctx.customerPhone });
  }
  if (ctx.customerEmail) {
    details.push({ label: "Email", value: ctx.customerEmail });
  }
  if (ctx.customerCity) {
    details.push({ label: "City", value: ctx.customerCity });
  }
  if (ctx.deliveryChoice) {
    details.push({ label: "Fulfillment", value: humanizeToken(ctx.deliveryChoice) });
  }
  if (ctx.paymentMethod) {
    details.push({ label: "Payment", value: humanizeToken(ctx.paymentMethod) });
  }
  if (options?.includePaymentStatus && ctx.paymentStatus) {
    details.push({ label: "Payment status", value: humanizeToken(ctx.paymentStatus) });
  }
  // Intentionally omit provider payment references (tx_ref / chapa ids) from merchant copy.
  if (ctx.shop) {
    details.push({ label: "Shop", value: ctx.shop });
  }
  if (ctx.when) {
    details.push({ label: "When", value: ctx.when });
  }
  return details;
}

/**
 * Code-side templates. Merchant-facing, detail-rich when payload allows.
 * No em dashes in user-facing copy. HTML bold for Telegram/email where supported.
 */
export function createCodeNotificationRenderer(): NotificationRenderer {
  return {
    render(input: RenderNotificationInput): RenderNotificationResult {
      const data = asRecord(input.payload);
      const ctx = buildContext(data);

      const subjectFor = (title: string) =>
        input.channel === "email" || input.channel === "in_app" ? title : undefined;

      const finish = (title: string, message: { body: string; html: string }): RenderNotificationResult => {
        const result: RenderNotificationResult = {
          body: message.body,
          html: message.html,
        };
        const subject = subjectFor(title);
        if (subject !== undefined) {
          result.subject = subject;
        }
        return result;
      };

      switch (input.eventType) {
        case "notification.test": {
          // Recipient-facing: they already know they received it. Do not restate the address.
          const channelLabel =
            input.channel === "telegram"
              ? "Telegram"
              : input.channel === "email"
                ? "email"
                : "this channel";
          const title = "Connection looks good";
          const headline = ctx.shop
            ? `${ctx.shop}: ${channelLabel} alerts are working`
            : `${channelLabel.charAt(0).toUpperCase()}${channelLabel.slice(1)} alerts are working`;
          return finish(
            title,
            composeMessage(
              headline,
              [
                { label: "Status", value: "Delivery succeeded" },
                ctx.when
                  ? { label: "Checked", value: ctx.when }
                  : { label: "Checked", value: "Just now" },
              ],
              "This was a test from Settings > Notifications. You can ignore it.",
            ),
          );
        }

        // Legacy cod_order.created still renders if present in old logs; new emits use order.created only.
        case "cod_order.created":
        case "order.created": {
          const isCod =
            input.eventType === "cod_order.created" ||
            (ctx.paymentMethod?.toLowerCase() === "cod" ||
              ctx.paymentMethod?.toLowerCase() === "cash on delivery");
          const title = isCod
            ? ctx.orderRef === "order"
              ? "New COD order"
              : `New COD order ${ctx.orderRef}`
            : ctx.orderRef === "order"
              ? "New order"
              : `New order ${ctx.orderRef}`;
          const headline = isCod
            ? ctx.orderRef === "order"
              ? "You received a new cash-on-delivery order."
              : `You received a new COD order ${ctx.orderRef}.`
            : ctx.orderRef === "order"
              ? "You received a new order."
              : `You received a new order ${ctx.orderRef}.`;
          return finish(
            title,
            composeMessage(
              headline,
              orderDetails(
                {
                  ...ctx,
                  paymentMethod: ctx.paymentMethod ?? (isCod ? "cod" : undefined),
                },
                { includePaymentStatus: true },
              ),
              isCod
                ? "Open the order in your dashboard to confirm and prepare fulfillment."
                : "Open the order in your dashboard to review and fulfill it.",
            ),
          );
        }

        case "order.cancelled": {
          const title =
            ctx.orderRef === "order" ? "Order cancelled" : `Order ${ctx.orderRef} cancelled`;
          const headline =
            ctx.orderRef === "order"
              ? "An order was cancelled."
              : `Order ${ctx.orderRef} was cancelled.`;
          return finish(
            title,
            composeMessage(
              headline,
              orderDetails(ctx, { includePaymentStatus: true }),
              "No further action is required unless you need to restock or refund.",
            ),
          );
        }

        case "payment.paid": {
          const title =
            ctx.orderRef === "order" ? "Payment received" : `Payment received for ${ctx.orderRef}`;
          const headline =
            ctx.orderRef === "order"
              ? "A payment was received."
              : `Payment received for order ${ctx.orderRef}.`;
          const details = orderDetails({
            ...ctx,
            paymentStatus: ctx.paymentStatus ?? "paid",
          });
          const mapped = details.map((d) =>
            d.label === "Total" ? { label: "Amount", value: d.value } : d,
          );
          if (ctx.source?.includes("dashboard")) {
            mapped.push({ label: "Recorded as", value: humanizeToken(ctx.source) });
          }
          return finish(
            title,
            composeMessage(
              headline,
              mapped,
              "You can continue fulfillment for this order in the dashboard.",
            ),
          );
        }

        case "payment.failed": {
          const title =
            ctx.orderRef === "order" ? "Payment failed" : `Payment failed for ${ctx.orderRef}`;
          const headline =
            ctx.orderRef === "order"
              ? "A payment failed."
              : `Payment failed for order ${ctx.orderRef}.`;
          const details = orderDetails(ctx).map((d) =>
            d.label === "Total" ? { label: "Amount", value: d.value } : d,
          );
          return finish(
            title,
            composeMessage(
              headline,
              details,
              "Check the order in your dashboard or ask the customer to try again.",
            ),
          );
        }

        default: {
          const title = "Shop update";
          return finish(
            title,
            composeMessage("Something updated in your shop.", orderDetails(ctx), null),
          );
        }
      }
    },
  };
}
