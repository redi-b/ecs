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
  return [
    order.id,
    typeof order.displayId === "number" ? String(order.displayId) : null,
    order.email,
    order.delivery?.customerName,
    order.delivery?.customerPhone,
    order.delivery?.choice,
    order.delivery?.landmark,
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

export function formatOrderDisplayId(order: MerchantOrder) {
  return typeof order.displayId === "number" ? `#${order.displayId}` : order.id;
}

export function getOrderTotalSortValue(order: MerchantOrder) {
  return typeof order.total === "number" ? order.total : null;
}

export function formatOrderMoney(total: number | null, currencyCode: string | null) {
  if (typeof total !== "number") {
    return "Not available";
  }

  return new Intl.NumberFormat("en", {
    currency: currencyCode?.toUpperCase() || "ETB",
    style: "currency",
  }).format(total / 100);
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
