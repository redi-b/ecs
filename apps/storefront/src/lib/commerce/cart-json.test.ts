import assert from "node:assert/strict";
import test from "node:test";

import { cartJson, cartJsonError } from "./cart-json.js";
import type { StoreCart } from "./types.js";

test("cartJson returns a no-store cart snapshot and derived item count", async () => {
  const cart: StoreCart = {
    id: "cart_1",
    regionId: "reg_1",
    email: null,
    currencyCode: "etb",
    subtotal: 120,
    itemTotal: 120,
    itemSubtotal: 120,
    itemDiscountTotal: 0,
    shippingTotal: 0,
    shippingSubtotal: 0,
    shippingDiscountTotal: 0,
    taxTotal: 0,
    discountTotal: 0,
    originalTotal: 120,
    total: 120,
    promotions: [],
    items: [
      { id: "item_1", title: "Serum", quantity: 2, unitPrice: 60, total: 120, thumbnail: null, variantId: "var_1", productHandle: "serum", variantTitle: "50 ml", subtotal: 120, discountTotal: 0, originalTotal: 120 },
    ],
  };
  const response = cartJson(cart);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    ok: true,
    count: 2,
    cart,
  });
});

test("cartJsonError returns a safe mutation error payload", async () => {
  const response = cartJsonError("Cart not found.", 404);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, message: "Cart not found." });
});
