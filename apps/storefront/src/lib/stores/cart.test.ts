import assert from "node:assert/strict";
import test from "node:test";
import type { StoreCart } from "../commerce/types";
import {
  $cart,
  $cartCount,
  $cartDrawerOpen,
  $isCartMutating,
  addToCart,
  fetchCart,
  setCart,
  updateCartItemQuantity,
} from "./cart";

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

test("first add updates count and opens the drawer before the server responds, then rolls back", async () => {
  setCart(null, false);
  $cartDrawerOpen.set(false);
  const originalFetch = globalThis.fetch;
  let finish!: (value: Response) => void;
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => {
      finish = resolve;
    });
  try {
    const pending = addToCart({
      variantId: "var_1",
      quantity: 2,
      openDrawer: true,
      optimisticItem: { title: "Jacket", unitPrice: 1000, thumbnail: "/jacket.jpg" },
    });
    assert.equal($cartCount.get(), 2);
    assert.equal($cartDrawerOpen.get(), true);
    finish(Response.json({ ok: false, message: "Out of stock" }, { status: 409 }));
    assert.equal((await pending).ok, false);
    assert.equal($cart.get(), null);
    assert.equal($cartCount.get(), 0);
  } finally {
    globalThis.fetch = originalFetch;
    setCart(null, false);
    $cartDrawerOpen.set(false);
  }
});

test("cart nanostore rolls back optimistic update when network fails", async () => {
  setCart(mockCart, false);

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

test("another mutation cannot erase an in-flight optimistic addition", async () => {
  setCart(mockCart, false);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let finish!: (response: Response) => void;
  globalThis.fetch = async () => {
    calls++;
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  };
  try {
    const pending = addToCart({ variantId: "var_1", quantity: 1 });
    assert.equal($isCartMutating.get(), true);
    assert.equal((await updateCartItemQuantity("item_1", 9)).ok, false);
    assert.equal(calls, 1);
    finish(Response.json({ ok: true, cart: mockCart }));
    assert.equal((await pending).ok, true);
  } finally {
    globalThis.fetch = originalFetch;
    setCart(null, false);
  }
});

test("a late hydration response cannot replace a newer cart", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  // No browser needed: the hydration gate only checks window presence.
  globalThis.window = {} as Window & typeof globalThis;
  let finish!: (response: Response) => void;
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => {
      finish = resolve;
    });
  try {
    setCart(null, false);
    const pending = fetchCart();
    setCart(mockCart, false);
    finish(Response.json({ ok: true, cart: null }));
    await pending;
    assert.equal($cart.get()?.id, mockCart.id);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    setCart(null, false);
  }
});
