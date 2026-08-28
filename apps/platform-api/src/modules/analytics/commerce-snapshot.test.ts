import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder } from "../../types/index.js";
import { type CommerceSnapshotProduct, computeCommerceSnapshot } from "./commerce-snapshot.js";

describe("commerce snapshot", () => {
  it("computes complete current counts and excludes canceled orders from operational attention", () => {
    const rows = computeCommerceSnapshot({
      date: "2026-08-25",
      orders: [
        order({ id: "order_1", paymentStatus: "captured", fulfillmentStatus: "fulfilled" }),
        order({ id: "order_2", paymentStatus: "not_paid", fulfillmentStatus: "not_fulfilled" }),
        order({ id: "order_3", status: "canceled" }),
      ],
      products: [product("product_1", "published"), product("product_2", "draft")],
    });

    assert.deepEqual(
      rows.filter((row) => !row.dimensionKey),
      [
        metric("overview.products", 2),
        metric("overview.attention.draft_products", 1),
        metric("overview.attention.unpaid", 1),
        metric("overview.attention.unfulfilled", 1),
      ],
    );
    assert.deepEqual(
      rows.filter((row) => row.metricKey === "overview.payment_status"),
      [
        metric("overview.payment_status", 1, "status", "captured"),
        metric("overview.payment_status", 1, "status", "not_paid"),
      ],
    );
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

function product(id: string, status: string): CommerceSnapshotProduct {
  return { id, status };
}

function metric(metricKey: string, value: number, dimensionKey = "", dimensionValue = "") {
  return {
    currencyCode: "",
    date: "2026-08-25",
    dimensionKey,
    dimensionValue,
    metricKey,
    value,
  };
}
