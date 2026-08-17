import assert from "node:assert/strict";
import test from "node:test";

import { resolveStoreCartSummary } from "./cart-summary.js";
import type { StoreCart } from "./types.js";

test("resolves authoritative cart totals and separates code from automatic promotions", () => {
  const cart = {
    id: "cart_1",
    regionId: "reg_1",
    email: null,
    currencyCode: "etb",
    subtotal: 1_200,
    itemTotal: 1_000,
    itemSubtotal: 1_200,
    itemDiscountTotal: 200,
    shippingTotal: 0,
    shippingSubtotal: 100,
    shippingDiscountTotal: 100,
    taxTotal: 0,
    discountTotal: 200,
    originalTotal: 1_300,
    total: 1_000,
    promotions: [
      { id: "promo_code", code: "WELCOME", isAutomatic: false, applicationMethod: null },
      { id: "promo_auto", code: "AUTO", isAutomatic: true, applicationMethod: null },
    ],
    items: [],
  } satisfies StoreCart;

  assert.deepEqual(resolveStoreCartSummary(cart), {
    itemCount: 0,
    subtotal: 1_200,
    discountTotal: 200,
    shippingTotal: 0,
    shippingDiscountTotal: 100,
    taxTotal: 0,
    total: 1_000,
    savingsTotal: 200,
    appliedCodes: [cart.promotions[0]],
    automaticPromotions: [cart.promotions[1]],
  });
});
