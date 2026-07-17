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
  total: 100,
  delivery: {
    choice: "pickup",
    customerName: "Abebe Kebede",
    customerPhone: "0911000000",
    landmark: "Bole",
    notes: null,
  },
  items: [{ id: "li_1", title: "Yirgacheffe", quantity: 1, unitPrice: 100, total: 100, thumbnail: null }],
};

describe("formatMerchantOrderCode", () => {
  it("uses last 6 of the id without the order_ prefix", () => {
    assert.equal(formatMerchantOrderCode(sample.id), "23XYZ9");
  });
});

describe("orderMatchesQuery", () => {
  it("matches shop order codes case-insensitively", () => {
    assert.equal(orderMatchesQuery(sample, "23XYZ9"), true);
    assert.equal(orderMatchesQuery(sample, "23xyz9"), true);
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
