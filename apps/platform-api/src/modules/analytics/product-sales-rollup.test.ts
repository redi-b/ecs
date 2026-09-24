import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MerchantOrder, MerchantOrderLineItem } from "../../types/merchant-order.js";
import { computeProductSalesRollup } from "./product-sales-rollup.js";

const item: MerchantOrderLineItem = {
  id: "line_1",
  productId: "product_1",
  variantId: "variant_1",
  title: "Linen dress",
  variantTitle: "Small",
  quantity: 2,
  unitPrice: 100,
  total: 200,
  thumbnail: null,
};
function order(overrides: Partial<MerchantOrder> = {}): MerchantOrder {
  return {
    id: "order_1",
    displayId: 1,
    email: null,
    status: "pending",
    paymentStatus: "paid",
    fulfillmentStatus: "not_fulfilled",
    currencyCode: "ETB",
    total: 200,
    createdAt: "2026-09-12T21:30:00Z",
    updatedAt: "2026-09-13T08:00:00Z",
    items: [item],
    ...overrides,
  };
}

describe("Product sales records", () => {
  it("deduplicates source orders and lines and groups on Ethiopian dates", () => {
    const result = computeProductSalesRollup([order(), order({ items: [item, item] })]);
    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.rows[0], {
      date: "2026-09-13",
      productId: "product_1",
      variantId: "variant_1",
      productTitle: "Linen dress",
      variantTitle: "Small",
      thumbnail: null,
      units: 2,
      paidUnits: 2,
      orders: 1,
    });
    assert.equal(result.missingItemOrders, 0);
  });
  it("uses the latest order revision, including cancellation", () => {
    const result = computeProductSalesRollup([
      order(),
      order({ status: "canceled", updatedAt: "2026-09-14T09:00:00Z" }),
    ]);
    assert.deepEqual(result.rows, []);
  });
  it("keeps variant quantities separate and unpaid quantities out of paid units", () => {
    const result = computeProductSalesRollup([
      order(),
      order({
        id: "order_2",
        paymentStatus: "awaiting",
        items: [{ ...item, variantId: "variant_2", quantity: 3 }],
      }),
    ]);
    assert.deepEqual(
      result.rows.map((row) => [row.units, row.paidUnits]),
      [
        [2, 2],
        [3, 0],
      ],
    );
  });
  it("counts incomplete source data instead of inventing a product identity", () => {
    const result = computeProductSalesRollup([
      order({ items: [] }),
      order({ id: "order_2", items: [{ ...item, productId: null }] }),
    ]);
    assert.equal(result.missingItemOrders, 1);
    assert.equal(result.unassignedUnits, 2);
    assert.deepEqual(result.rows, []);
  });
  it("preserves order-time product and variant names", () => {
    const result = computeProductSalesRollup([
      order({ items: [{ ...item, productTitle: "Cotton dress", variantTitle: "Blue / Small" }] }),
    ]);
    assert.equal(result.rows[0]?.productTitle, "Cotton dress");
    assert.equal(result.rows[0]?.variantTitle, "Blue / Small");
  });
});
