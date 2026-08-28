import type { MerchantOrder } from "../../types/merchant-order.js";

export const COMMERCE_ROLLUP_KEY = "commerce.daily";
export const COMMERCE_ROLLUP_VERSION = 1;
export const DEFAULT_REPORTING_TIMEZONE = "Africa/Addis_Ababa";
export const DEFAULT_REPORTING_CURRENCY = "ETB";

const paidStatuses = new Set(["captured", "paid"]);

export type CommerceRollupRow = {
  currencyCode: string;
  date: string;
  dimensionKey: string;
  dimensionValue: string;
  metricKey:
    | "overview.customers"
    | "overview.customers.repeat"
    | "overview.customers.unique"
    | "overview.orders"
    | "overview.revenue";
  value: number;
};

export type CommerceRollupResult =
  | {
      ok: true;
      currencyCode: string;
      rows: CommerceRollupRow[];
      sourceOrderCount: number;
      timezone: string;
    }
  | {
      ok: false;
      error: "commerce_rollup_currency_unsupported" | "commerce_rollup_timezone_invalid";
    };

export function computeCommerceDailyRollup(input: {
  currencyCode?: string | undefined;
  orders: MerchantOrder[];
  timezone?: string | undefined;
}): CommerceRollupResult {
  const timezone = input.timezone?.trim() || DEFAULT_REPORTING_TIMEZONE;
  const currencyCode = input.currencyCode?.trim().toUpperCase() || DEFAULT_REPORTING_CURRENCY;
  let dateFormatter: Intl.DateTimeFormat;
  try {
    dateFormatter = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    });
  } catch {
    return { ok: false, error: "commerce_rollup_timezone_invalid" };
  }

  const latestById = new Map<string, MerchantOrder>();
  for (const order of input.orders) {
    const existing = latestById.get(order.id);
    if (!existing || timestamp(order.updatedAt) >= timestamp(existing.updatedAt)) {
      latestById.set(order.id, order);
    }
  }

  const buckets = new Map<string, { customers: Set<string>; orders: number; revenue: number }>();
  const customerOrders = new Map<string, number>();

  for (const order of latestById.values()) {
    if (order.status?.trim().toLowerCase() === "canceled" || !order.createdAt) continue;
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;
    const orderCurrency = order.currencyCode?.trim().toUpperCase() || currencyCode;
    if (orderCurrency !== currencyCode) {
      return { ok: false, error: "commerce_rollup_currency_unsupported" };
    }
    const date = formatDate(dateFormatter, createdAt);
    const bucket = buckets.get(date) ?? { customers: new Set(), orders: 0, revenue: 0 };
    bucket.orders += 1;
    const customerIdentity = order.customerId?.trim() || order.email?.trim().toLowerCase();
    if (customerIdentity) {
      bucket.customers.add(customerIdentity);
      customerOrders.set(customerIdentity, (customerOrders.get(customerIdentity) ?? 0) + 1);
    }
    if (paidStatuses.has(order.paymentStatus?.trim().toLowerCase() ?? "")) {
      bucket.revenue += Math.max(order.total ?? 0, 0);
    }
    buckets.set(date, bucket);
  }

  const rows: CommerceRollupRow[] = [];
  for (const [date, bucket] of [...buckets.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    rows.push(
      metricRow(date, "overview.orders", bucket.orders),
      metricRow(date, "overview.customers", bucket.customers.size),
      metricRow(date, "overview.revenue", bucket.revenue, currencyCode),
    );
  }
  const latestDate = [...buckets.keys()].sort().at(-1);
  if (latestDate) {
    rows.push(
      metricRow(latestDate, "overview.customers.unique", customerOrders.size),
      metricRow(
        latestDate,
        "overview.customers.repeat",
        [...customerOrders.values()].filter((count) => count > 1).length,
      ),
    );
  }

  return {
    ok: true,
    currencyCode,
    rows,
    sourceOrderCount: latestById.size,
    timezone,
  };
}

function formatDate(formatter: Intl.DateTimeFormat, value: Date) {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type === "day" || part.type === "month" || part.type === "year")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function metricRow(
  date: string,
  metricKey: CommerceRollupRow["metricKey"],
  value: number,
  currencyCode = "",
): CommerceRollupRow {
  return { currencyCode, date, dimensionKey: "", dimensionValue: "", metricKey, value };
}

function timestamp(value: string | null | undefined) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
