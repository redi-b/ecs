import assert from "node:assert/strict";
import test from "node:test";

import { cartJson, cartJsonError } from "./cart-json.js";

test("cartJson returns a no-store cart snapshot and derived item count", async () => {
  const response = cartJson({
    id: "cart_1",
    regionId: "reg_1",
    email: null,
    currencyCode: "etb",
    itemTotal: 120,
    shippingTotal: 0,
    total: 120,
    items: [
      { id: "item_1", title: "Serum", quantity: 2, unitPrice: 60, total: 120, thumbnail: null, variantId: "var_1", productHandle: "serum", variantTitle: "50 ml" },
    ],
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    ok: true,
    count: 2,
    cart: {
      id: "cart_1",
      regionId: "reg_1",
      email: null,
      currencyCode: "etb",
      itemTotal: 120,
      shippingTotal: 0,
      total: 120,
      items: [
        { id: "item_1", title: "Serum", quantity: 2, unitPrice: 60, total: 120, thumbnail: null, variantId: "var_1", productHandle: "serum", variantTitle: "50 ml" },
      ],
    },
  });
});

test("cartJsonError returns a safe mutation error payload", async () => {
  const response = cartJsonError("Cart not found.", 404);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, message: "Cart not found." });
});
