import assert from "node:assert/strict";
import test from "node:test";
import { $cartError, $isCartMutating } from "../stores/cart";
import { initCartFeedback } from "./cart-feedback";

test("all template drawers expose localized pending totals and failure feedback", async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const attributes = new Map<string, string>();
  let shimmer = false;
  const total = {
    classList: {
      toggle: (_name: string, enabled: boolean) => {
        shimmer = enabled;
      },
    },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
  };
  const checkout = {
    setAttribute: (name: string, value: string) => attributes.set(`checkout:${name}`, value),
  };
  const status = { textContent: "" };
  const drawer = {
    setAttribute: (name: string, value: string) => attributes.set(`drawer:${name}`, value),
    querySelector: (selector: string) => (selector === "[data-cart-status]" ? status : null),
    querySelectorAll: (selector: string) => (selector.includes("checkout") ? [checkout] : [total]),
  };
  globalThis.window = {
    __ECS_AFRO_MESSAGES__: { cartUpdating: "በማዘመን ላይ", cartUpdateFailed: "እንደገና ይሞክሩ" },
  } as unknown as Window & typeof globalThis;
  globalThis.document = {
    querySelectorAll: (selector: string) => {
      assert.ok(selector.includes("[data-cart-modal]"));
      return [drawer];
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as Document;
  const dispose = initCartFeedback();
  try {
    $isCartMutating.set(true);
    await Promise.resolve();
    assert.equal(shimmer, true);
    assert.equal(attributes.get("checkout:aria-disabled"), "true");
    assert.equal(status.textContent, "በማዘመን ላይ");
    $cartError.set("server failure");
    $isCartMutating.set(false);
    assert.equal(status.textContent, "እንደገና ይሞክሩ");
    assert.equal(shimmer, false);
  } finally {
    dispose();
    $cartError.set(null);
    $isCartMutating.set(false);
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
