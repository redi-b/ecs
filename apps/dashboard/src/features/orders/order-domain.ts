import type { MerchantOrder } from "@ecs/contracts";
import type { MessageKey } from "@/i18n/messages";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

export type OrderProgress = "new" | "ready" | "completed" | "canceled";
export type OrderPaymentLabel = "unpaid" | "paid" | "failed";
export type OrderMethodLabel = "cod" | "chapa" | "unknown";
export type OrderDeliveryLabel = "delivery" | "pickup" | "unknown";

export type OrderNextActionType =
  | "mark_ready"
  | "mark_completed"
  | "mark_paid"
  | "none";

export type OrderNextAction = {
  type: OrderNextActionType;
  label: string;
  description: string;
};

export type OrderFinishStep = {
  id: string;
  label: string;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Shop-facing order code from Medusa id (last 6 chars after stripping `order_`).
 * Keep in sync with platform-api `formatMerchantOrderCode` / list search.
 */
export function formatOrderReference(order: Pick<MerchantOrder, "id">) {
  const id = order.id ?? "";
  const raw = id.replace(/^order_/i, "");
  const tail = (raw || id).slice(-6).toUpperCase();
  return tail || id.slice(-6).toUpperCase();
}

export function getOrderProgress(order: MerchantOrder): OrderProgress {
  const status = normalize(order.status);
  const fulfillment = normalize(order.fulfillmentStatus);

  if (status.includes("cancel")) {
    return "canceled";
  }

  if (status.includes("complete") || fulfillment.includes("deliver")) {
    return "completed";
  }

  // Avoid matching substring "fulfill" inside "not_fulfilled".
  if (
    fulfillment === "fulfilled" ||
    fulfillment === "partially_fulfilled" ||
    fulfillment === "shipped" ||
    fulfillment === "partially_shipped" ||
    fulfillment.startsWith("fulfill") ||
    fulfillment.includes("ship")
  ) {
    // "not_fulfilled" contains neither exact fulfilled nor ship.
    if (fulfillment === "not_fulfilled" || fulfillment.startsWith("not_")) {
      return "new";
    }
    return "ready";
  }

  return "new";
}

export function getOrderProgressLabel(progress: OrderProgress, t?: Translate) {
  switch (progress) {
    case "new":
      return t ? t("orders.labels.progressNew") : "New";
    case "ready":
      return t ? t("orders.labels.progressReady") : "Ready";
    case "completed":
      return t ? t("orders.labels.progressCompleted") : "Completed";
    case "canceled":
      return t ? t("orders.labels.progressCanceled") : "Canceled";
  }
}

export function getPaymentLabel(order: MerchantOrder): OrderPaymentLabel {
  const value = normalize(order.paymentStatus);
  if (value.includes("captured") || value === "paid" || value.includes("refund")) {
    return "paid";
  }
  if (value.includes("fail") || value === "canceled" || value === "cancelled") {
    return "failed";
  }
  return "unpaid";
}

export function getPaymentStatusLabel(label: OrderPaymentLabel, t?: Translate) {
  switch (label) {
    case "paid":
      return t ? t("orders.labels.paymentPaid") : "Paid";
    case "failed":
      return t ? t("orders.labels.paymentFailed") : "Failed";
    case "unpaid":
      return t ? t("orders.labels.paymentUnpaid") : "Unpaid";
  }
}

export function getMethodLabel(order: MerchantOrder): OrderMethodLabel {
  const method = order.paymentMethod ?? "unknown";
  if (method === "cod" || method === "chapa") return method;
  return "unknown";
}

export function getMethodDisplayLabel(method: OrderMethodLabel, t?: Translate) {
  switch (method) {
    case "cod":
      return t ? t("orders.labels.methodCash") : "Cash";
    case "chapa":
      return t ? t("orders.labels.methodOnline") : "Online";
    case "unknown":
      return t ? t("orders.labels.methodPayment") : "Payment";
  }
}

export function getMethodShortLabel(method: OrderMethodLabel, t?: Translate) {
  switch (method) {
    case "cod":
      return t ? t("orders.labels.methodCash") : "Cash";
    case "chapa":
      return t ? t("orders.labels.methodOnline") : "Online";
    case "unknown":
      return t ? t("orders.labels.methodUnknown") : "—";
  }
}

export function getDeliveryLabel(order: MerchantOrder): OrderDeliveryLabel {
  const choice = normalize(order.delivery?.choice);
  if (choice.includes("pickup") || choice.includes("collect")) return "pickup";
  if (choice.includes("deliver") || choice === "shipping" || choice === "local_delivery") {
    return "delivery";
  }
  return "unknown";
}

export function getDeliveryDisplayLabel(label: OrderDeliveryLabel, t?: Translate) {
  switch (label) {
    case "delivery":
      return t ? t("orders.labels.deliveryLocal") : "Local delivery";
    case "pickup":
      return t ? t("orders.labels.deliveryPickup") : "Customer pickup";
    case "unknown":
      return t ? t("orders.labels.deliveryUnknown") : "—";
  }
}

export function getOrderCustomerName(order: MerchantOrder, t?: Translate) {
  const fromDelivery = order.delivery?.customerName?.trim();
  if (fromDelivery) return fromDelivery;

  const fromAddress = [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromAddress) return fromAddress;

  return order.email?.trim() || (t ? t("orders.labels.customerFallback") : "Customer");
}

export function getOrderCustomerPhone(order: MerchantOrder) {
  return (
    order.delivery?.customerPhone?.trim() ||
    order.shippingAddress?.phone?.trim() ||
    null
  );
}

export function formatOrderMoney(amount: number | null | undefined, currencyCode?: string | null) {
  if (amount == null || Number.isNaN(amount)) return "—";
  const code = (currencyCode ?? "ETB").toUpperCase();
  try {
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${Math.round(amount).toLocaleString("en-ET")}`;
  }
}

export function formatOrderDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  // Pin locale — `undefined` can yield odd month forms (e.g. "M07") in some runtimes.
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatOrderRelativeTime(value: string | null | undefined, now = new Date()) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absMinutes < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");
  return formatOrderDateTime(value);
}

export function getOrderItemsSummary(order: MerchantOrder, t?: Translate) {
  const items = order.items ?? [];
  const count =
    order.itemCount ??
    items.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ??
    items.length;

  if (!count) return t ? t("orders.labels.noItems") : "No items";
  if (items.length === 0) {
    return count === 1
      ? t
        ? t("orders.labels.itemOne")
        : "1 item"
      : t
        ? t("orders.labels.itemsCount", { count })
        : `${count} items`;
  }

  const first = items[0]?.title?.trim() || (t ? t("orders.labels.itemFallback") : "Item");
  if (items.length === 1) {
    const qty = items[0]?.quantity ?? 1;
    return qty > 1 ? `${first} × ${qty}` : first;
  }
  return t
    ? t("orders.labels.itemsMore", { first, count: items.length - 1 })
    : `${first} +${items.length - 1} more`;
}

export function getNextAction(order: MerchantOrder): OrderNextAction {
  const progress = getOrderProgress(order);
  const payment = getPaymentLabel(order);
  const method = getMethodLabel(order);

  if (progress === "canceled") {
    return {
      type: "none",
      label: "No action",
      description: "This order was canceled.",
    };
  }

  if (progress === "new") {
    return {
      type: "mark_ready",
      label: "Mark ready",
      description: "Pack the items so they are ready for delivery or pickup.",
    };
  }

  if (progress === "ready") {
    return {
      type: "mark_completed",
      label: "Mark completed",
      description: "Customer has the order (delivered or picked up).",
    };
  }

  // completed — unpaid COD (or unknown method treated as local cash)
  if (payment === "unpaid" && (method === "cod" || method === "unknown")) {
    return {
      type: "mark_paid",
      label: "Mark as paid",
      description: "Record that you received the cash for this order.",
    };
  }

  return {
    type: "none",
    label: "All done",
    description: "No further steps for this order.",
  };
}

export function getRemainingFinishSteps(
  order: MerchantOrder,
  options?: { includeMarkPaid?: boolean },
): OrderFinishStep[] {
  const steps: OrderFinishStep[] = [];
  const progress = getOrderProgress(order);
  const payment = getPaymentLabel(order);
  const method = getMethodLabel(order);

  if (progress === "canceled" || progress === "completed") {
    // Still allow mark paid for COD after completed
  } else if (progress === "new") {
    steps.push({ id: "ready", label: "Mark ready (pack items)" });
    steps.push({ id: "completed", label: "Mark completed (customer has the order)" });
  } else if (progress === "ready") {
    steps.push({ id: "completed", label: "Mark completed (customer has the order)" });
  }

  if (options?.includeMarkPaid && payment === "unpaid" && (method === "cod" || method === "unknown")) {
    steps.push({ id: "paid", label: "Mark as paid (cash received)" });
  }

  return steps;
}

export function canMarkPaid(order: MerchantOrder) {
  const progress = getOrderProgress(order);
  const payment = getPaymentLabel(order);
  return progress !== "canceled" && payment === "unpaid";
}

export function canRecheckPayment(order: MerchantOrder) {
  const method = getMethodLabel(order);
  const payment = getPaymentLabel(order);
  return method === "chapa" && payment !== "paid";
}

export function isOrderOpen(order: MerchantOrder) {
  const progress = getOrderProgress(order);
  return progress === "new" || progress === "ready";
}

/** URL filter parsers for server-backed list params. */
export type OrderListFilterState = {
  created: "all" | "today" | "last_7_days" | "last_30_days";
  delivery: "all" | "delivery" | "pickup";
  method: "all" | "cod" | "chapa";
  payment: "all" | "unpaid" | "paid" | "failed";
  progress: "all" | "new" | "ready" | "completed" | "canceled" | "open";
  q: string;
};

export function parseOrderListFilters(
  params: Record<string, string | string[] | undefined>,
): OrderListFilterState {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    q: one("q")?.trim() ?? "",
    progress: parseEnum(one("progress"), [
      "all",
      "new",
      "ready",
      "completed",
      "canceled",
      "open",
    ] as const, "all"),
    payment: parseEnum(one("payment"), ["all", "unpaid", "paid", "failed"] as const, "all"),
    method: parseEnum(one("method"), ["all", "cod", "chapa"] as const, "all"),
    delivery: parseEnum(one("delivery"), ["all", "delivery", "pickup"] as const, "all"),
    created: parseEnum(
      one("created"),
      ["all", "today", "last_7_days", "last_30_days"] as const,
      "all",
    ),
  };
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

export function orderListFiltersToQuery(filters: OrderListFilterState): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.q) out.q = filters.q;
  if (filters.progress !== "all") out.progress = filters.progress;
  if (filters.payment !== "all") out.payment = filters.payment;
  if (filters.method !== "all") out.method = filters.method;
  if (filters.delivery !== "all") out.delivery = filters.delivery;
  if (filters.created !== "all") out.created = filters.created;
  return out;
}
