import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder } from "../../types/merchant-order.js";
import { computeCommerceDailyRollup } from "./commerce-rollup.js";

describe("commerce daily rollup", () => {
  it("uses Addis Ababa calendar days, settled revenue, and unique ordering customers", () => {
    const result = computeCommerceDailyRollup({
      orders: [
        order({
          createdAt: "2026-08-24T21:30:00.000Z",
          customerId: "customer_1",
          id: "order_1",
          paymentStatus: "captured",
          total: 1200,
        }),
        order({
          createdAt: "2026-08-25T08:00:00.000Z",
          email: "ONE@EXAMPLE.COM",
          id: "order_2",
          paymentStatus: "not_paid",
          total: 900,
        }),
        order({
          createdAt: "2026-08-25T09:00:00.000Z",
          id: "order_3",
          status: "canceled",
          total: 500,
        }),
      ],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.timezone, "Africa/Addis_Ababa");
    assert.deepEqual(result.rows, [
      row("overview.orders", 2),
      row("overview.customers", 2),
      row("overview.revenue", 1200, "ETB"),
      row("overview.customers.unique", 2),
      row("overview.customers.repeat", 0),
    ]);
  });

  it("deduplicates out-of-order order revisions using the latest updated timestamp", () => {
    const result = computeCommerceDailyRollup({
      orders: [
        order({
          id: "order_1",
          paymentStatus: "captured",
          total: 1000,
          updatedAt: "2026-08-25T10:00:00Z",
        }),
        order({
          id: "order_1",
          paymentStatus: "not_paid",
          total: 1000,
          updatedAt: "2026-08-25T09:00:00Z",
        }),
      ],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sourceOrderCount, 1);
    assert.equal(result.rows.find((item) => item.metricKey === "overview.revenue")?.value, 1000);
  });

  it("fails closed when the source contains another currency", () => {
    const result = computeCommerceDailyRollup({
      currencyCode: "ETB",
      orders: [order({ currencyCode: "USD" })],
    });

    assert.deepEqual(result, { ok: false, error: "commerce_rollup_currency_unsupported" });
  });
});

function order(overrides: Partial<MerchantOrder>): MerchantOrder {
  return {
    createdAt: "2026-08-25T08:00:00.000Z",
    currencyCode: "ETB",
    displayId: 1,
    email: null,
    fulfillmentStatus: "not_fulfilled",
    id: "order_default",
    paymentStatus: "not_paid",
    status: "pending",
    total: 0,
    updatedAt: "2026-08-25T08:00:00.000Z",
    ...overrides,
  };
}

function row(
  metricKey:
    | "overview.customers"
    | "overview.customers.repeat"
    | "overview.customers.unique"
    | "overview.orders"
    | "overview.revenue",
  value: number,
  currencyCode = "",
) {
  return {
    currencyCode,
    date: "2026-08-25",
    dimensionKey: "",
    dimensionValue: "",
    metricKey,
    value,
  };
}
