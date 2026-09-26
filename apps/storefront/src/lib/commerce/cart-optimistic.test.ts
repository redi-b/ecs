import assert from "node:assert/strict";
import test from "node:test";
import type { StoreCart } from "./types";
import {
  projectCartAddition,
  projectCartItemQuantity,
  snapshotCart,
} from "./cart-optimistic";

const cart: StoreCart = {
  id: "cart_1",
  regionId: "region_1",
  email: null,
  currencyCode: "ETB",
  subtotal: 900,
  itemTotal: 900,
  itemSubtotal: 1000,
  itemDiscountTotal: 100,
  shippingTotal: 50,
  shippingSubtotal: 50,
  shippingDiscountTotal: 0,
  taxTotal: 0,
  discountTotal: 100,
  originalTotal: 1050,
  total: 950,
  promotions: [],
  items: [
    {
      id: "line_1",
      variantId: "variant_1",
      title: "Jacket",
      quantity: 1,
      unitPrice: 1000,
      subtotal: 1000,
      total: 900,
      discountTotal: 100,
      originalTotal: 1000,
      thumbnail: null,
      productHandle: "jacket",
      variantTitle: null,
    },
  ],
};

test("quantity projection changes inventory intent without inventing totals", () => {
  const projected = projectCartItemQuantity(cart, "line_1", 3);

  assert.equal(projected.items[0]?.quantity, 3);
  assert.equal(projected.items[0]?.total, 900);
  assert.equal(projected.subtotal, 900);
  assert.equal(projected.discountTotal, 100);
  assert.equal(projected.total, 950);
});

test("addition projection leaves server-owned aggregate pricing unchanged", () => {
  const projected = projectCartAddition(cart, {
    variantId: "variant_1",
    quantity: 2,
    optimisticId: "optimistic_1",
  });

  assert.equal(projected.items[0]?.quantity, 3);
  assert.equal(projected.total, cart.total);
  assert.equal(projected.discountTotal, cart.discountTotal);
});

test("snapshots do not share mutable cart items", () => {
  const snapshot = snapshotCart(cart);
  assert.ok(snapshot);
  snapshot.items[0]!.quantity = 9;
  assert.equal(cart.items[0]?.quantity, 1);
});
