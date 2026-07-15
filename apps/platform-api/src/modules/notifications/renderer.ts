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

type Detail = { label: string; value: string };

function detailLines(details: Detail[]): string[] {
  return details
    .filter((d) => d.value.trim())
    .map((d) => `${d.label}: ${d.value.trim()}`);
}

function composeBody(headline: string, details: Detail[], footer?: string | null): string {
  const parts = [headline, ...detailLines(details)];
  if (footer?.trim()) {
    parts.push("", footer.trim());
  }
  return parts.join("\n");
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
  const orderRef = formatOrderRef(
    pickScalar(data, "orderDisplayId", "displayId", "orderId", "txRef"),
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
    txRef: pickScalar(data, "txRef", "providerReference", "paymentReference"),
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
  if (ctx.txRef) {
    details.push({ label: "Reference", value: ctx.txRef });
  }
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
 */
export function createCodeNotificationRenderer(): NotificationRenderer {
  return {
    render(input: RenderNotificationInput): RenderNotificationResult {
      const data = asRecord(input.payload);
      const ctx = buildContext(data);

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
          const destination = pickScalar(data, "destinationLabel", "targetLabel");
          const channelLabel =
            input.channel === "telegram"
              ? "Telegram"
              : input.channel === "email"
                ? "Email"
                : "this channel";
          const title = "Test notification";
          const headline = ctx.shop
            ? `Test alert for ${ctx.shop}`
            : "Test alert from your shop dashboard";
          const body = composeBody(
            headline,
            [
              { label: "Status", value: "Delivery is working" },
              destination ? { label: "Sent to", value: destination } : { label: "Via", value: channelLabel },
              ctx.when ? { label: "Sent", value: ctx.when } : { label: "Sent", value: "Just now" },
              ctx.shop ? { label: "Shop", value: ctx.shop } : { label: "", value: "" },
            ].filter((d) => d.label),
            "You can ignore this message — it was sent from Settings → Notifications.",
          );
          return withSubject(title, body);
        }

        case "cod_order.created": {
          const title =
            ctx.orderRef === "order" ? "New COD order" : `New COD order ${ctx.orderRef}`;
          const headline =
            ctx.orderRef === "order"
              ? "You received a new cash-on-delivery order."
              : `You received a new COD order ${ctx.orderRef}.`;
          return withSubject(
            title,
            composeBody(
              headline,
              orderDetails({
                ...ctx,
                paymentMethod: ctx.paymentMethod ?? "cod",
              }),
              "Open the order in your dashboard to confirm and prepare fulfillment.",
            ),
          );
        }

        case "order.created": {
          const title = ctx.orderRef === "order" ? "New order" : `New order ${ctx.orderRef}`;
          const headline =
            ctx.orderRef === "order"
              ? "You received a new order."
              : `You received a new order ${ctx.orderRef}.`;
          return withSubject(
            title,
            composeBody(
              headline,
              orderDetails(ctx, { includePaymentStatus: true }),
              "Open the order in your dashboard to review and fulfill it.",
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
          return withSubject(
            title,
            composeBody(
              headline,
              orderDetails(ctx, { includePaymentStatus: true }),
              "No further action is required unless you need to restock or refund.",
            ),
          );
        }

        case "payment.paid": {
          const title =
            ctx.orderRef === "order" ? "Payment received" : `Payment received · ${ctx.orderRef}`;
          const headline =
            ctx.orderRef === "order"
              ? "A payment was received."
              : `Payment received for order ${ctx.orderRef}.`;
          const details = orderDetails({
            ...ctx,
            paymentStatus: ctx.paymentStatus ?? "paid",
          });
          // Prefer Amount label for payment events
          const mapped = details.map((d) =>
            d.label === "Total" ? { label: "Amount", value: d.value } : d,
          );
          if (ctx.source?.includes("dashboard")) {
            mapped.push({ label: "Recorded as", value: humanizeToken(ctx.source) });
          }
          return withSubject(
            title,
            composeBody(
              headline,
              mapped,
              "You can continue fulfillment for this order in the dashboard.",
            ),
          );
        }

        case "payment.failed": {
          const title =
            ctx.orderRef === "order" ? "Payment failed" : `Payment failed · ${ctx.orderRef}`;
          const headline =
            ctx.orderRef === "order"
              ? "A payment failed."
              : `Payment failed for order ${ctx.orderRef}.`;
          const details = orderDetails(ctx).map((d) =>
            d.label === "Total" ? { label: "Amount", value: d.value } : d,
          );
          return withSubject(
            title,
            composeBody(
              headline,
              details,
              "Check the order in your dashboard or ask the customer to try again.",
            ),
          );
        }

        default: {
          const title = "Shop update";
          return withSubject(
            title,
            composeBody(
              "Something updated in your shop.",
              orderDetails(ctx),
              null,
            ),
          );
        }
      }
    },
  };
}
