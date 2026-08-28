import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder } from "../../../types/index.js";
import { formatMerchantOrderCode, orderMatchesQuery } from "./list-query.js";

const sample: MerchantOrder = {
  id: "order_01HABCDEF123XYZ9",
  displayId: 1024,
  email: "buyer@example.com",
  status: "pending",
  paymentStatus: "not_paid",
  fulfillmentStatus: "not_fulfilled",
  currencyCode: "etb",
  createdAt: "2026-08-25T08:00:00.000Z",
  total: 100,
  delivery: {
    choice: "pickup",
    customerName: "Abebe Kebede",
    customerPhone: "0911000000",
    landmark: "Bole",
    notes: null,
  },
  items: [
    { id: "li_1", title: "Yirgacheffe", quantity: 1, unitPrice: 100, total: 100, thumbnail: null },
  ],
  updatedAt: "2026-08-25T08:00:00.000Z",
};

describe("formatMerchantOrderCode", () => {
  it("uses the shared tenant-safe public reference", () => {
    assert.equal(formatMerchantOrderCode(sample.id), "ORD-DEF123XYZ9");
  });
});

describe("orderMatchesQuery", () => {
  it("matches shop order codes case-insensitively", () => {
    assert.equal(orderMatchesQuery(sample, "ORD-DEF123XYZ9"), true);
    assert.equal(orderMatchesQuery(sample, "ord-def123xyz9"), true);
    assert.equal(orderMatchesQuery(sample, "xyz9"), true);
  });

  it("matches customer and product text", () => {
    assert.equal(orderMatchesQuery(sample, "abebe"), true);
    assert.equal(orderMatchesQuery(sample, "yirgacheffe"), true);
    assert.equal(orderMatchesQuery(sample, "buyer@example.com"), true);
  });

  it("rejects non-matches", () => {
    assert.equal(orderMatchesQuery(sample, "nope-not-here"), false);
  });
});

describe("applyOrderListPostFilters customerId", () => {
  it("keeps only orders for the given customer", async () => {
    const { applyOrderListPostFilters } = await import("./list-query.js");
    const orders: MerchantOrder[] = [
      { ...sample, id: "order_a", customerId: "cus_1" },
      { ...sample, id: "order_b", customerId: "cus_2" },
      { ...sample, id: "order_c", customerId: null },
    ];
    const filtered = applyOrderListPostFilters(orders, {
      customerId: "cus_1",
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "order_a");
  });
});
