import type { MerchantOrder, MerchantProduct, MerchantProductVariant } from "../../types/index.js";
import type { TelegramProductHit } from "./telegram-dialog-state.js";
import { formatMoneyAmount, formatOrderRef, humanizeToken } from "./renderer.js";

/** Prefer shop hostname; fall back to platform dashboard base. */
export function resolveDashboardAdminBase(input: {
  primaryHostname?: string | null;
  fallbackBaseUrl?: string | null;
}): string | null {
  const host = input.primaryHostname?.trim();
  if (host) {
    const local =
      host.includes("localhost") ||
      host.endsWith(".lvh.me") ||
      host.startsWith("127.") ||
      host.endsWith(".local");
    const scheme = local ? "http" : "https";
    return `${scheme}://${host}/admin`;
  }
  const base = input.fallbackBaseUrl?.trim();
  if (!base) return null;
  try {
    const url = new URL(base);
    // Ensure path ends at host root then /admin
    return `${url.origin}/admin`;
  } catch {
    return null;
  }
}

/** base is `…/admin`. subpath like `/settings?tab=telegram` or `orders`. */
export function adminUrl(base: string | null, subpath = ""): string | null {
  if (!base) return null;
  const root = base.replace(/\/$/, "");
  if (!subpath) return root;
  const path = subpath.startsWith("/") ? subpath : `/${subpath}`;
  return `${root}${path}`;
}

export function htmlLink(href: string | null, label: string): string {
  if (!href) return label;
  const safe = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<a href="${safe}">${label}</a>`;
}

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

function isPlaceholderCustomerName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return /^(customer|unknown|guest|n\/?a|-)$/i.test(name.trim());
}

function isSyntheticOrderEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const e = email.trim().toLowerCase();
  return e.endsWith("@orders.local") || e.startsWith("telegram+");
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
  if (name && !isPlaceholderCustomerName(name)) lines.push(name);
  if (phone) lines.push(phone);
  if (order.email && !isSyntheticOrderEmail(order.email)) {
    lines.push(order.email);
  }
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
    for (const item of items.slice(0, 8)) {
      lines.push(`· ${formatOrderLineItemLabel(item)}`);
    }
    if (items.length > 8) lines.push(`· +${items.length - 8} more`);
  }
  return lines.join("\n");
}

/** Product · variant × qty for order cards and notifications. */
export function formatOrderLineItemLabel(item: {
  title?: string | null;
  productTitle?: string | null;
  variantTitle?: string | null;
  quantity?: number | null;
}): string {
  const product =
    (item.productTitle ?? item.title ?? "Item").trim() || "Item";
  const variant = (item.variantTitle ?? "").trim();
  const showVariant =
    Boolean(variant) &&
    !/^default$/i.test(variant) &&
    variant.toLowerCase() !== product.toLowerCase() &&
    !product.toLowerCase().includes(variant.toLowerCase());
  const base = showVariant ? `${product} · ${variant}` : product;
  const q =
    item.quantity != null && Number.isFinite(item.quantity) && item.quantity > 0
      ? ` × ${item.quantity}`
      : "";
  return `${base}${q}`;
}

/** Compact lines for notification payloads (max 8). */
export function buildOrderItemLines(
  items: Array<{
    title?: string | null;
    productTitle?: string | null;
    variantTitle?: string | null;
    quantity?: number | null;
  }> | null | undefined,
  limit = 8,
): string[] {
  if (!items?.length) return [];
  const lines = items.slice(0, limit).map((item) => formatOrderLineItemLabel(item));
  if (items.length > limit) lines.push(`+${items.length - limit} more`);
  return lines;
}
