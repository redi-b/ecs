import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder, MerchantProduct } from "../../types/index.js";
import { buildRecentProductHits } from "./telegram-recent-products.js";

function order(items: MerchantOrderLineItem[]): MerchantOrder {
  return {
    id: "ord_1",
    displayId: 1,
    email: null,
    status: "pending",
    paymentStatus: "not_paid",
    fulfillmentStatus: "not_fulfilled",
    currencyCode: "etb",
    total: 100,
    items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

type MerchantOrderLineItem = NonNullable<MerchantOrder["items"]>[number];

function product(
  id: string,
  title: string,
  variants: Array<{ id: string; title: string }>,
): MerchantProduct {
  return {
    id,
    title,
    handle: id,
    status: "published",
    thumbnail: null,
    variants: variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: null,
      prices: [],
      stock: {
        locationId: "loc",
        stockedQuantity: 5,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 5,
      },
    })),
    createdAt: null,
    updatedAt: null,
  };
}

describe("buildRecentProductHits", () => {
  it("prefers order variants and de-dupes", () => {
    const orders = [
      order([
        {
          id: "li1",
          productId: "p1",
          variantId: "v1",
          title: "Blue Shirt",
          quantity: 1,
          unitPrice: 10,
          total: 10,
          thumbnail: null,
        },
        {
          id: "li2",
          productId: "p1",
          variantId: "v1",
          title: "Blue Shirt again",
          quantity: 1,
          unitPrice: 10,
          total: 10,
          thumbnail: null,
        },
      ]),
    ];
    const catalog = [product("p2", "Cap", [{ id: "v2", title: "One" }])];
    const hits = buildRecentProductHits({ orders, catalogProducts: catalog, limit: 6 });
    assert.deepEqual(
      hits.map((h) => h.variantId),
      ["v1", "v2"],
    );
  });

  it("fills from catalog when no order items", () => {
    const catalog = [
      product("p1", "A", [{ id: "va", title: "S" }]),
      product("p2", "B", [{ id: "vb", title: "M" }]),
    ];
    const hits = buildRecentProductHits({ orders: [], catalogProducts: catalog, limit: 1 });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.variantId, "va");
  });
});
