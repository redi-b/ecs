import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TelegramDialogState } from "./telegram-dialog-state.js";
import { cartFromDialog, parseQty, saleItemsFromDialog } from "./telegram-sale-flow.js";

function dialog(overrides: Partial<TelegramDialogState> = {}): TelegramDialogState {
  return {
    expiresAt: Date.now() + 60_000,
    flow: "sale",
    regionId: "reg_1",
    salesChannelId: "sc_1",
    shippingOptionId: null,
    step: "cart_menu",
    stockLocationId: "sl_1",
    tenantId: "tenant_1",
    userId: "user_1",
    ...overrides,
  };
}

describe("telegram sale flow state", () => {
  it("accepts only whole quantities at or above the requested minimum", () => {
    assert.equal(parseQty(" 3 ", 1), 3);
    assert.equal(parseQty("0", 1), null);
    assert.equal(parseQty("1.5", 1), null);
    assert.equal(parseQty("three", 1), null);
  });

  it("prefers the multi-item cart when constructing a manual order", () => {
    const state = dialog({
      cart: [
        {
          productId: "prod_1",
          productTitle: "Coffee",
          quantity: 2,
          variantId: "variant_1",
          variantTitle: "250 g",
        },
        {
          productId: "prod_2",
          productTitle: "Tea",
          quantity: 1,
          variantId: "variant_2",
          variantTitle: "Box",
        },
      ],
      quantity: 9,
      variantId: "stale_variant",
    });

    assert.deepEqual(saleItemsFromDialog(state), [
      { quantity: 2, variantId: "variant_1" },
      { quantity: 1, variantId: "variant_2" },
    ]);
  });

  it("does not expose the dialog's mutable cart array", () => {
    const state = dialog({
      cart: [
        {
          productId: "prod_1",
          productTitle: "Coffee",
          quantity: 1,
          variantId: "variant_1",
          variantTitle: "Default",
        },
      ],
    });

    const cart = cartFromDialog(state);
    cart.pop();
    assert.equal(state.cart?.length, 1);
  });
});
