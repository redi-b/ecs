import type { MerchantOrder, MerchantProduct, MerchantProductVariant } from "../../types/index.js";
import type { TelegramProductHit } from "./telegram-dialog-state.js";
import { formatMoneyAmount, formatOrderRef, humanizeToken } from "./renderer.js";

/** Compact payment for list buttons. */
export function shortPaymentLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const h = humanizeToken(status);
  if (h === "Paid" || h === "Partially refunded") return "Paid";
  if (h === "Unpaid" || h === "Awaiting payment" || h === "Pending") return "Unpaid";
  if (h === "Failed") return "Failed";
  if (h === "Refunded") return "Refunded";
  return h.slice(0, 12);
}

export function orderCustomerName(order: MerchantOrder): string | null {
  const name =
    order.delivery?.customerName?.trim() ||
    [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
  return name || null;
}

export function orderCustomerPhone(order: MerchantOrder): string | null {
  return order.delivery?.customerPhone?.trim() || order.shippingAddress?.phone?.trim() || null;
}

function firstItemSummary(order: MerchantOrder): string | null {
  const items = order.items ?? [];
  if (items.length === 0) return null;
  const first = items[0]!;
  const title = (first.title ?? "Item").trim() || "Item";
  const qty = first.quantity != null && first.quantity > 1 ? ` ×${first.quantity}` : "";
  const more = items.length > 1 ? ` +${items.length - 1}` : "";
  return `${title}${qty}${more}`.slice(0, 28);
}

/**
 * Button label for recent orders (max 64 Telegram chars; we use 56).
 * Prefers customer name, then first item, always includes short ref + money + pay.
 */
export function formatOrderListButtonLabel(order: MerchantOrder): string {
  const ref = formatOrderRef(order.id);
  const pay = shortPaymentLabel(order.paymentStatus);
  const totalRaw =
    order.total != null
      ? formatMoneyAmount(String(order.total), order.currencyCode ?? undefined)
      : null;
  // Prefer amount without repeating long currency if space is tight
  const total =
    totalRaw?.replace(/^ETB\s+/i, "").replace(/^([A-Z]{3})\s+/, "") ?? "-";

  const who = orderCustomerName(order) || firstItemSummary(order) || "Order";
  // e.g. "Abebe · 7,800 Unpaid · BY4JVY"
  const label = `${who} · ${total} ${pay} · ${ref}`;
  return label.slice(0, 56);
}

export function formatVariantLabel(variant: MerchantProductVariant): string {
  const fromOptions = (variant.optionValues ?? [])
    .map((ov) => ov.value?.trim())
    .filter((v): v is string => Boolean(v));
  if (fromOptions.length > 0) return fromOptions.join(" / ");

  const title = (variant.title ?? "").trim();
  if (title && !/^default$/i.test(title)) return title;

  const sku = variant.sku?.trim();
  if (sku) return sku;

  // Last resort so multi-variant products with empty titles stay distinguishable
  const tail = variant.id.replace(/^variant_/i, "").slice(-4).toUpperCase();
  return tail || "";
}

export function catalogHitFromVariant(
  product: MerchantProduct,
  variant: MerchantProductVariant,
): TelegramProductHit {
  const available =
    variant.stock?.availableQuantity ?? variant.stock?.stockedQuantity ?? null;
  return {
    productId: product.id,
    productTitle: product.title ?? "Product",
    variantId: variant.id,
    variantTitle: formatVariantLabel(variant) || "Default",
    sku: variant.sku ?? null,
    availableQuantity: available,
  };
}

/** Human item line for messages (not buttons). */
export function formatItemLine(title?: string | null, variant?: string | null, qty?: number | null) {
  const base = (() => {
    const t = (title ?? "Item").trim();
    const v = (variant ?? "").trim();
    if (!v || /^default$/i.test(v) || v === t) return t;
    return `${t} · ${v}`;
  })();
  if (qty != null && qty > 0) return `${base} × ${qty}`;
  return base;
}

export function formatOrderCardHtml(order: MerchantOrder): string {
  const ref = formatOrderRef(order.id);
  const total =
    order.total != null
      ? formatMoneyAmount(String(order.total), order.currencyCode ?? undefined) ??
        String(order.total)
      : null;
  const name = orderCustomerName(order);
  const phone = orderCustomerPhone(order);
  const items = order.items ?? [];

  const lines: string[] = [`<b>Order ${ref}</b>`];
  if (name) lines.push(name);
  if (phone) lines.push(phone);
  if (total) lines.push(`Total ${total}`);
  if (order.paymentStatus) {
    lines.push(
      `Payment ${humanizeToken(order.paymentStatus)}${
        order.paymentMethod ? ` · ${humanizeToken(order.paymentMethod)}` : ""
      }`,
    );
  }
  if (order.fulfillmentStatus) {
    lines.push(`Status ${humanizeToken(order.fulfillmentStatus)}`);
  }
  if (order.delivery?.choice) {
    lines.push(humanizeToken(order.delivery.choice));
  }
  if (order.shippingAddress?.city) {
    lines.push(order.shippingAddress.city);
  }
  if (items.length > 0) {
    lines.push("");
    for (const item of items.slice(0, 6)) {
      const q = item.quantity != null ? ` × ${item.quantity}` : "";
      lines.push(`· ${(item.title ?? "Item").trim()}${q}`);
    }
    if (items.length > 6) lines.push(`· +${items.length - 6} more`);
  }
  return lines.join("\n");
}
