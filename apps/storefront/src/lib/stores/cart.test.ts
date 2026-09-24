import test from "node:test";
import assert from "node:assert/strict";
import {
  $cart,
  $cartCount,
  setCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  applyPromotion,
} from "./cart";
import type { StoreCart } from "../commerce/types";

const mockCart: StoreCart = {
  id: "cart_123",
  regionId: "reg_123",
  email: "test@example.com",
  currencyCode: "ETB",
  subtotal: 1000,
  itemTotal: 1000,
  itemSubtotal: 1000,
  itemDiscountTotal: 0,
  shippingTotal: 100,
  shippingSubtotal: 100,
  shippingDiscountTotal: 0,
  taxTotal: 0,
  discountTotal: 0,
  originalTotal: 1000,
  total: 1100,
  promotions: [],
  items: [
    {
      id: "item_1",
      variantId: "var_1",
      title: "Leather Jacket",
      quantity: 1,
      unitPrice: 1000,
      total: 1000,
      subtotal: 1000,
      discountTotal: 0,
      originalTotal: 1000,
      thumbnail: "/test.jpg",
      productHandle: "leather-jacket",
      variantTitle: "M / Brown",
    },
  ],
};

test("cart nanostore computes cart count correctly", () => {
  setCart(mockCart, false);
  assert.equal($cartCount.get(), 1);

  const twoItems: StoreCart = {
    ...mockCart,
    items: [
      ...mockCart.items,
      {
        id: "item_2",
        variantId: "var_2",
        title: "T-Shirt",
        quantity: 3,
        unitPrice: 200,
        total: 600,
        subtotal: 600,
        discountTotal: 0,
        originalTotal: 600,
        thumbnail: null,
        productHandle: "t-shirt",
        variantTitle: "L",
      },
    ],
  };

  setCart(twoItems, false);
  assert.equal($cartCount.get(), 4);
});

test("cart nanostore rolls back optimistic update when network fails", async () => {
  setCart(mockCart, false);
  const original = $cart.get();

  // Mock global fetch to fail
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: false,
      json: async () => ({ ok: false, message: "Out of stock" }),
    } as Response;
  }) as typeof fetch;

  try {
    const result = await updateCartItemQuantity("item_1", 5);
    assert.equal(result.ok, false);
    assert.equal(result.error, "Out of stock");
    // State should have rolled back to 1
    assert.equal($cart.get()?.items[0]?.quantity, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
