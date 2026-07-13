import type {
  MerchantOrder,
  MerchantOrderCreatedPreset,
  MerchantOrderDeliveryFilter,
  MerchantOrderListQuery,
  MerchantOrderMethodFilter,
  MerchantOrderPaymentFilter,
  MerchantOrderProgressFilter,
} from "../../../types/index.js";

const PROGRESS_VALUES = new Set<MerchantOrderProgressFilter>([
  "new",
  "ready",
  "completed",
  "canceled",
  "open",
]);

const PAYMENT_VALUES = new Set<MerchantOrderPaymentFilter>(["unpaid", "paid", "failed"]);
const METHOD_VALUES = new Set<MerchantOrderMethodFilter>(["cod", "chapa"]);
const DELIVERY_VALUES = new Set<MerchantOrderDeliveryFilter>(["delivery", "pickup"]);
const CREATED_VALUES = new Set<MerchantOrderCreatedPreset>(["today", "last_7_days", "last_30_days"]);

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function parseMerchantOrderListQuery(
  query: Record<string, string | undefined>,
  base: { limit: number; offset: number; salesChannelId: string },
): MerchantOrderListQuery {
  const progress = parseEnum(query.progress, PROGRESS_VALUES);
  const paymentStatus = parseEnum(query.paymentStatus ?? query.payment, PAYMENT_VALUES);
  const paymentMethod = parseEnum(query.paymentMethod ?? query.method, METHOD_VALUES);
  const delivery = parseEnum(query.delivery, DELIVERY_VALUES);
  const created = parseEnum(query.created, CREATED_VALUES);
  const q = query.q?.trim() || undefined;
  const createdFrom = query.createdFrom?.trim() || undefined;
  const createdTo = query.createdTo?.trim() || undefined;

  return {
    ...base,
    ...(progress ? { progress } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(delivery ? { delivery } : {}),
    ...(created ? { created } : {}),
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdTo ? { createdTo } : {}),
    ...(q ? { q } : {}),
  };
}

function parseEnum<T extends string>(value: string | undefined, allowed: Set<T>): T | undefined {
  if (!value) return undefined;
  const normalized = normalizeKey(value) as T;
  return allowed.has(normalized) ? normalized : undefined;
}

/** Expand created preset into ISO from/to (UTC day bounds for today). */
export function resolveCreatedRange(
  input: Pick<MerchantOrderListQuery, "created" | "createdFrom" | "createdTo">,
  now = new Date(),
): { createdFrom?: string; createdTo?: string } {
  if (input.createdFrom || input.createdTo) {
    return {
      ...(input.createdFrom ? { createdFrom: input.createdFrom } : {}),
      ...(input.createdTo ? { createdTo: input.createdTo } : {}),
    };
  }

  if (!input.created) {
    return {};
  }

  const end = now.toISOString();
  if (input.created === "today") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { createdFrom: start.toISOString(), createdTo: end };
  }

  const days = input.created === "last_7_days" ? 7 : 30;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { createdFrom: start.toISOString(), createdTo: end };
}

export function orderMatchesProgress(order: MerchantOrder, progress: MerchantOrderProgressFilter) {
  const status = normalizeKey(order.status);
  const fulfillment = normalizeKey(order.fulfillmentStatus);

  if (progress === "canceled") {
    return status.includes("cancel");
  }

  if (status.includes("cancel")) {
    return false;
  }

  if (progress === "completed") {
    return status.includes("complete") || fulfillment.includes("deliver");
  }

  if (progress === "open") {
    return !status.includes("complete") && !status.includes("cancel");
  }

  if (progress === "ready") {
    // Packed but not handed over / closed.
    if (status.includes("complete") || fulfillment.includes("deliver")) {
      return false;
    }
    if (fulfillment === "not_fulfilled" || fulfillment.startsWith("not_")) {
      return false;
    }
    return (
      fulfillment === "fulfilled" ||
      fulfillment === "partially_fulfilled" ||
      fulfillment.includes("ship") ||
      fulfillment.startsWith("fulfill")
    );
  }

  // new — still packing
  if (status.includes("complete") || fulfillment.includes("deliver")) {
    return false;
  }
  if (fulfillment === "not_fulfilled" || fulfillment === "" || fulfillment.startsWith("not_")) {
    return true;
  }
  if (
    fulfillment === "fulfilled" ||
    fulfillment === "partially_fulfilled" ||
    fulfillment.includes("ship") ||
    fulfillment.startsWith("fulfill")
  ) {
    return false;
  }
  return true;
}

export function orderMatchesPaymentStatus(
  order: MerchantOrder,
  paymentStatus: MerchantOrderPaymentFilter,
) {
  const value = normalizeKey(order.paymentStatus);
  const paid = value.includes("captured") || value === "paid" || value.includes("refund");
  const failed = value.includes("fail") || value === "canceled" || value === "cancelled";
  const unpaid =
    !paid &&
    !failed &&
    (value.includes("not_paid") ||
      value.includes("await") ||
      value.includes("pending") ||
      value.includes("authorized") ||
      value.includes("require") ||
      value === "" ||
      value === "unknown");

  if (paymentStatus === "paid") return paid;
  if (paymentStatus === "failed") return failed;
  return unpaid || (!paid && !failed);
}

export function orderMatchesPaymentMethod(
  order: MerchantOrder,
  method: MerchantOrderMethodFilter,
) {
  const value = order.paymentMethod ?? "unknown";
  return value === method;
}

export function orderMatchesDelivery(order: MerchantOrder, delivery: MerchantOrderDeliveryFilter) {
  const choice = normalizeKey(order.delivery?.choice);
  if (delivery === "pickup") {
    return choice.includes("pickup") || choice.includes("collect");
  }
  return choice.includes("deliver") || choice === "shipping" || choice === "local_delivery";
}

export function orderMatchesQuery(order: MerchantOrder, q: string) {
  const needle = normalizeKey(q);
  if (!needle) return true;

  const haystack = [
    order.id,
    order.displayId != null ? String(order.displayId) : "",
    order.id.slice(-6),
    order.email,
    order.customerId,
    order.note,
    order.paymentReference,
    order.delivery?.customerName,
    order.delivery?.customerPhone,
    order.delivery?.landmark,
    order.delivery?.notes,
    order.shippingAddress?.firstName,
    order.shippingAddress?.lastName,
    order.shippingAddress?.phone,
    order.shippingAddress?.address1,
    ...(order.items ?? []).map((item) => item.title),
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

/**
 * Filters that Medusa cannot express reliably (metadata / derived labels)
 * are applied after normalize.
 */
export function needsPostFilter(input: MerchantOrderListQuery) {
  return Boolean(input.paymentMethod || input.delivery || input.progress || input.q);
}

export function applyOrderListPostFilters(orders: MerchantOrder[], input: MerchantOrderListQuery) {
  return orders.filter((order) => {
    if (input.progress && !orderMatchesProgress(order, input.progress)) return false;
    if (input.paymentStatus && !orderMatchesPaymentStatus(order, input.paymentStatus)) return false;
    if (input.paymentMethod && !orderMatchesPaymentMethod(order, input.paymentMethod)) return false;
    if (input.delivery && !orderMatchesDelivery(order, input.delivery)) return false;
    if (input.q && !orderMatchesQuery(order, input.q)) return false;
    return true;
  });
}
