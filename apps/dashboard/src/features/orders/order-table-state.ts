import type { MerchantOrder } from "@ecs/contracts";

export type OrderLifecycleFilter =
  | "all"
  | "open"
  | "completed"
  | "canceled"
  | "needs_fulfillment"
  | "fulfilled"
  | "payment_pending"
  | "paid";
export type OrderPaymentFilter = "all" | "paid" | "pending" | "unpaid" | "unknown";
export type OrderFulfillmentFilter =
  | "all"
  | "needs_fulfillment"
  | "fulfilled"
  | "unfulfilled"
  | "unknown";
export type OrderDeliveryFilter = "all" | "delivery" | "pickup" | "none";
export type OrderDateFilter = "all" | "today" | "last_7_days" | "last_30_days" | "no_date";

export type OrderTableFilterInput = {
  created?: OrderDateFilter | undefined;
  delivery?: OrderDeliveryFilter | undefined;
  fulfillment?: OrderFulfillmentFilter | undefined;
  lifecycle: OrderLifecycleFilter;
  now?: Date | undefined;
  payment?: OrderPaymentFilter | undefined;
  query: string;
};

export function filterOrdersForTable(orders: MerchantOrder[], input: OrderTableFilterInput) {
  const query = input.query.trim().toLowerCase();

  return orders.filter((order) => {
    const matchesQuery = !query || getOrderSearchText(order).includes(query);
    const matchesLifecycle = orderMatchesLifecycle(order, input.lifecycle);
    const matchesPayment = orderMatchesPayment(order, input.payment ?? "all");
    const matchesFulfillment = orderMatchesFulfillment(order, input.fulfillment ?? "all");
    const matchesDelivery = orderMatchesDelivery(order, input.delivery ?? "all");
    const matchesCreated = orderMatchesCreatedDate(order, input.created ?? "all", input.now);

    return (
      matchesQuery &&
      matchesLifecycle &&
      matchesPayment &&
      matchesFulfillment &&
      matchesDelivery &&
      matchesCreated
    );
  });
}

export function getOrderSearchText(order: MerchantOrder) {
  const code = formatOrderReference(order);
  return [
    order.id,
    order.id.replace(/^order_/i, ""),
    order.id.slice(-6),
    code,
    typeof order.displayId === "number" ? String(order.displayId) : null,
    order.email,
    getOrderCustomerName(order),
    getOrderCustomerPhone(order),
    order.delivery?.customerName,
    order.delivery?.customerPhone,
    order.delivery?.choice,
    order.delivery?.landmark,
    order.paymentMethod,
    order.status,
    order.paymentStatus,
    order.fulfillmentStatus,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

export function normalizeOrderLifecycle(order: MerchantOrder): OrderLifecycleFilter {
  const status = normalizeStatus(order.status);
  const paymentStatus = normalizeStatus(order.paymentStatus);
  const fulfillmentStatus = normalizeStatus(order.fulfillmentStatus);

  if (isCanceledStatus(status)) {
    return "canceled";
  }

  if (isCompletedStatus(status)) {
    return "completed";
  }

  if (isNeedsFulfillmentStatus(fulfillmentStatus)) {
    return "needs_fulfillment";
  }

  if (isFulfilledStatus(fulfillmentStatus)) {
    return "fulfilled";
  }

  if (isPaidStatus(paymentStatus)) {
    return "paid";
  }

  if (isPaymentPendingStatus(paymentStatus)) {
    return "payment_pending";
  }

  return "open";
}

export function parseOrderLifecycleFilter(value: string | string[] | null | undefined) {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (
    normalized === "open" ||
    normalized === "completed" ||
    normalized === "canceled" ||
    normalized === "needs_fulfillment" ||
    normalized === "fulfilled" ||
    normalized === "payment_pending" ||
    normalized === "paid"
  ) {
    return normalized;
  }

  return "all";
}

export function parseOrderPaymentFilter(
  value: string | string[] | null | undefined,
): OrderPaymentFilter {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (
    normalized === "paid" ||
    normalized === "pending" ||
    normalized === "unpaid" ||
    normalized === "unknown"
  ) {
    return normalized;
  }

  return "all";
}

export function parseOrderFulfillmentFilter(
  value: string | string[] | null | undefined,
): OrderFulfillmentFilter {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (
    normalized === "needs_fulfillment" ||
    normalized === "fulfilled" ||
    normalized === "unfulfilled" ||
    normalized === "unknown"
  ) {
    return normalized;
  }

  return "all";
}

export function parseOrderDeliveryFilter(
  value: string | string[] | null | undefined,
): OrderDeliveryFilter {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (normalized === "delivery" || normalized === "pickup" || normalized === "none") {
    return normalized;
  }

  return "all";
}

export function parseOrderDateFilter(value: string | string[] | null | undefined): OrderDateFilter {
  const normalized = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();

  if (
    normalized === "today" ||
    normalized === "last_7_days" ||
    normalized === "last_30_days" ||
    normalized === "no_date"
  ) {
    return normalized;
  }

  return "all";
}

export function getOrderTableCounts(input: {
  filteredCount: number;
  filters: OrderTableFilterInput;
  pageCount: number;
  totalCount: number;
}) {
  const { filters, ...counts } = input;

  return {
    ...counts,
    hasActiveFilter:
      filters.query.trim().length > 0 ||
      filters.lifecycle !== "all" ||
      (filters.payment ?? "all") !== "all" ||
      (filters.fulfillment ?? "all") !== "all" ||
      (filters.delivery ?? "all") !== "all" ||
      (filters.created ?? "all") !== "all",
  };
}

/**
 * Shop-friendly order code from Medusa id.
 * Avoid global display_id — it increments across the whole shared commerce DB.
 * Same algorithm as order-domain.formatOrderReference (list UI + search).
 */
export function formatOrderReference(order: Pick<MerchantOrder, "id">) {
  const id = order.id ?? "";
  const raw = id.replace(/^order_/i, "");
  const tail = (raw || id).slice(-6).toUpperCase();
  return tail || id.slice(-6).toUpperCase();
}

export function formatOrderDisplayId(order: MerchantOrder) {
  return formatOrderReference(order);
}

/** Real person name only — never falls back to email (avoids list redundancy). */
export function getOrderCustomerName(order: MerchantOrder) {
  if (order.delivery?.customerName?.trim()) {
    return order.delivery.customerName.trim();
  }

  const fromAddress = [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();

  return fromAddress || null;
}

export function getOrderCustomerPhone(order: MerchantOrder) {
  return (
    order.delivery?.customerPhone?.trim() ||
    order.shippingAddress?.phone?.trim() ||
    null
  );
}

export function getOrderCustomerPrimaryLine(order: MerchantOrder) {
  return getOrderCustomerName(order) ?? order.email?.trim() ?? "No customer";
}

export function getOrderCustomerSecondaryLine(order: MerchantOrder) {
  const name = getOrderCustomerName(order);
  const phone = getOrderCustomerPhone(order);
  const email = order.email?.trim() || null;

  // If we already show the email as the primary line, prefer phone underneath.
  if (!name && email) {
    return phone && phone !== email ? phone : null;
  }

  if (phone) return phone;
  if (email) return email;
  return null;
}

export function getOrderTotalSortValue(order: MerchantOrder) {
  return typeof order.total === "number" ? order.total : null;
}

/**
 * Medusa v2 amounts for ETB are major units (same as product prices in catalog).
 */
export function formatOrderMoney(total: number | null, currencyCode: string | null) {
  if (typeof total !== "number") {
    return "Not available";
  }

  return new Intl.NumberFormat("en-ET", {
    currency: currencyCode?.toUpperCase() || "ETB",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(total);
}

/**
 * Plain-language status for shop owners (avoid commerce jargon).
 */
export function formatOrderStatusLabel(
  status: string | null | undefined,
  tone: "fulfillment" | "order" | "payment" = "order",
) {
  const key = status?.trim().toLowerCase().replaceAll(" ", "_") ?? "";

  if (tone === "payment") {
    if (["captured", "paid"].includes(key)) return "Paid";
    if (["not_paid", "awaiting", "pending"].includes(key)) return "Not paid yet";
    if (key.includes("refund")) return "Refunded";
  }

  if (tone === "fulfillment") {
    if (["not_fulfilled", "unfulfilled"].includes(key)) return "To prepare";
    if (["partially_fulfilled", "partially_shipped"].includes(key)) return "Partly ready";
    if (["fulfilled", "shipped"].includes(key)) return "Ready";
    if (key === "delivered") return "Delivered";
    if (key.includes("cancel")) return "Canceled";
  }

  if (tone === "order") {
    if (["pending", "requires_action", "draft"].includes(key)) return "New";
    if (key === "completed") return "Done";
    if (key.includes("cancel")) return "Canceled";
  }

  if (!status?.trim()) return "Unknown";
  return status.replaceAll("_", " ");
}

/** One simple status for list rows (collapses order + fulfillment noise). */
export function getOrderSimpleStatus(order: MerchantOrder) {
  const status = (order.status ?? "").toLowerCase();
  const fulfillment = (order.fulfillmentStatus ?? "").toLowerCase();

  if (status.includes("cancel")) return "Canceled";
  if (status === "completed") return "Done";
  if (fulfillment === "delivered") return "Delivered";
  if (["fulfilled", "shipped", "partially_fulfilled"].includes(fulfillment)) return "Ready";
  return "New";
}

/**
 * Payment label for merchants. Completed local/COD orders should not look unpaid.
 */
export function getOrderPaymentLabel(order: MerchantOrder) {
  const status = (order.status ?? "").toLowerCase();
  const payment = (order.paymentStatus ?? "").toLowerCase();

  if (status.includes("cancel")) return "—";
  if (["captured", "paid"].includes(payment)) return "Paid";
  if (payment.includes("refund")) return "Refunded";
  if (status === "completed") return "Settled";
  if (["not_paid", "awaiting", "pending", ""].includes(payment)) return "Not paid yet";
  return formatOrderStatusLabel(order.paymentStatus, "payment");
}

export function getOrderProgressSteps(order: MerchantOrder) {
  const fulfillment = (order.fulfillmentStatus ?? "").toLowerCase();
  const status = (order.status ?? "").toLowerCase();
  const isCanceled = status.includes("cancel");
  const ready =
    ["fulfilled", "shipped", "delivered", "partially_fulfilled"].includes(fulfillment) ||
    (order.fulfillments?.length ?? 0) > 0;
  const delivered =
    fulfillment === "delivered" ||
    (order.fulfillments ?? []).some((item) => Boolean(item.deliveredAt));
  const completed = status === "completed";

  return [
    { done: !isCanceled, id: "received", label: "Received" },
    { done: ready || delivered || completed, id: "ready", label: "Ready" },
    { done: delivered || completed, id: "delivered", label: "Delivered" },
    { done: completed, id: "done", label: "Done" },
  ] as const;
}

export function hasFulfillableItems(order: MerchantOrder) {
  return (order.items ?? []).some((item) => {
    const quantity = item.quantity ?? 0;
    const fulfilledQuantity = item.fulfilledQuantity ?? 0;
    return quantity - fulfilledQuantity > 0;
  });
}

export function formatOrderDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function orderMatchesLifecycle(order: MerchantOrder, lifecycle: OrderLifecycleFilter) {
  if (lifecycle === "all") {
    return true;
  }

  const status = normalizeStatus(order.status);
  const paymentStatus = normalizeStatus(order.paymentStatus);
  const fulfillmentStatus = normalizeStatus(order.fulfillmentStatus);

  switch (lifecycle) {
    case "canceled":
      return isCanceledStatus(status);
    case "completed":
      return isCompletedStatus(status);
    case "fulfilled":
      return isFulfilledStatus(fulfillmentStatus);
    case "needs_fulfillment":
      return isNeedsFulfillmentStatus(fulfillmentStatus);
    case "paid":
      return isPaidStatus(paymentStatus);
    case "payment_pending":
      return isPaymentPendingStatus(paymentStatus);
    case "open":
      return normalizeOrderLifecycle(order) === "open";
  }
}

function orderMatchesPayment(order: MerchantOrder, paymentFilter: OrderPaymentFilter) {
  if (paymentFilter === "all") {
    return true;
  }

  const paymentStatus = normalizeStatus(order.paymentStatus);

  if (paymentFilter === "unknown") {
    return !paymentStatus;
  }

  if (paymentFilter === "paid") {
    return isPaidStatus(paymentStatus);
  }

  if (paymentFilter === "pending") {
    return isPaymentPendingStatus(paymentStatus);
  }

  return paymentStatus.includes("not_paid") || paymentStatus.includes("unpaid");
}

function orderMatchesFulfillment(order: MerchantOrder, fulfillmentFilter: OrderFulfillmentFilter) {
  if (fulfillmentFilter === "all") {
    return true;
  }

  const fulfillmentStatus = normalizeStatus(order.fulfillmentStatus);

  if (fulfillmentFilter === "unknown") {
    return !fulfillmentStatus;
  }

  if (fulfillmentFilter === "fulfilled") {
    return isFulfilledStatus(fulfillmentStatus);
  }

  if (fulfillmentFilter === "needs_fulfillment") {
    return isNeedsFulfillmentStatus(fulfillmentStatus);
  }

  return fulfillmentStatus.includes("not_fulfilled") || fulfillmentStatus.includes("unfulfilled");
}

function orderMatchesDelivery(order: MerchantOrder, deliveryFilter: OrderDeliveryFilter) {
  if (deliveryFilter === "all") {
    return true;
  }

  const deliveryChoice = order.delivery?.choice?.trim().toLowerCase();

  if (deliveryFilter === "none") {
    return !deliveryChoice;
  }

  return deliveryChoice === deliveryFilter;
}

function orderMatchesCreatedDate(
  order: MerchantOrder,
  dateFilter: OrderDateFilter,
  now = new Date(),
) {
  if (dateFilter === "all") {
    return true;
  }

  if (!order.createdAt) {
    return dateFilter === "no_date";
  }

  const createdAt = new Date(order.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    return dateFilter === "no_date";
  }

  if (dateFilter === "no_date") {
    return false;
  }

  const ageMs = startOfUtcDay(now).getTime() - startOfUtcDay(createdAt).getTime();
  const ageDays = Math.floor(ageMs / 86_400_000);

  if (dateFilter === "today") {
    return ageDays === 0;
  }

  if (dateFilter === "last_7_days") {
    return ageDays >= 0 && ageDays <= 6;
  }

  return ageDays >= 0 && ageDays <= 29;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeStatus(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isCanceledStatus(status: string) {
  return status.includes("cancel");
}

function isCompletedStatus(status: string) {
  return status.includes("complete");
}

function isFulfilledStatus(fulfillmentStatus: string) {
  return (
    fulfillmentStatus === "fulfilled" ||
    fulfillmentStatus === "delivered" ||
    fulfillmentStatus.includes("fully_fulfilled")
  );
}

function isNeedsFulfillmentStatus(fulfillmentStatus: string) {
  return (
    fulfillmentStatus.includes("not_fulfilled") ||
    fulfillmentStatus.includes("requires") ||
    fulfillmentStatus.includes("unfulfilled")
  );
}

function isPaidStatus(paymentStatus: string) {
  return paymentStatus.includes("captured") || paymentStatus === "paid";
}

function isPaymentPendingStatus(paymentStatus: string) {
  return paymentStatus.includes("awaiting") || paymentStatus.includes("pending");
}
