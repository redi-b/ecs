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

export type OrderTableFilterInput = {
  lifecycle: OrderLifecycleFilter;
  query: string;
};

export function filterOrdersForTable(
  orders: MerchantOrder[],
  input: OrderTableFilterInput,
) {
  const query = input.query.trim().toLowerCase();

  return orders.filter((order) => {
    const matchesQuery = !query || getOrderSearchText(order).includes(query);
    const matchesLifecycle = orderMatchesLifecycle(order, input.lifecycle);

    return matchesQuery && matchesLifecycle;
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

export function getOrderTableCounts(input: {
  filteredCount: number;
  filters: OrderTableFilterInput;
  pageCount: number;
  totalCount: number;
}) {
  const { filters, ...counts } = input;

  return {
    ...counts,
    hasActiveFilter: filters.query.trim().length > 0 || filters.lifecycle !== "all",
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
