export const metricRegistry = {
  "overview.revenue": {
    dimensions: [] as const,
    kind: "flow",
    unit: "currency_minor" as const,
  },
  "overview.orders": {
    dimensions: [] as const,
    kind: "flow",
    unit: "count" as const,
  },
  "overview.customers": {
    dimensions: [] as const,
    kind: "flow",
    unit: "count" as const,
  },
  "overview.customers.unique": {
    dimensions: [] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
  "overview.customers.repeat": {
    dimensions: [] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
  "overview.order_status": {
    dimensions: ["status"] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
  "overview.payment_status": {
    dimensions: ["status"] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
  "overview.fulfillment_status": {
    dimensions: ["status"] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
  "overview.products": {
    dimensions: [] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
  "overview.attention.unfulfilled": {
    dimensions: [] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
  "overview.attention.unpaid": {
    dimensions: [] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
  "overview.attention.draft_products": {
    dimensions: [] as const,
    kind: "snapshot",
    unit: "count" as const,
  },
} as const;

export type RegisteredMetricKey = keyof typeof metricRegistry;

export const registeredMetricKeys = Object.keys(metricRegistry) as RegisteredMetricKey[];

export function isRegisteredMetricKey(value: string): value is RegisteredMetricKey {
  return Object.hasOwn(metricRegistry, value);
}
