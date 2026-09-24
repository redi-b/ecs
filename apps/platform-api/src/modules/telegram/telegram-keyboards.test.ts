import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cartMenuInline,
  formatCartSummary,
  hitButtonLabel,
  matchesMainLabel,
  MAIN_KEYBOARD_LABELS,
  productPickInline,
  qtyInline,
} from "./telegram-keyboards.js";

describe("telegram-keyboards", () => {
  it("sale qty chips never include 0", () => {
    const data = JSON.stringify(qtyInline("sale"));
    assert.equal(data.includes("t:q0"), false);
    assert.equal(data.includes("t:q1"), true);
  });

  it("stock qty chips include Out as 0", () => {
    const data = JSON.stringify(qtyInline("stock"));
    assert.equal(data.includes("t:q0"), true);
  });

  it("product pick includes Search", () => {
    const kb = productPickInline([
      {
        productId: "p1",
        productTitle: "Shirt",
        variantId: "v1",
        variantTitle: "M",
        availableQuantity: 3,
      },
    ]);
    const flat = kb.inline_keyboard.flat().map((b) => b.callback_data);
    assert.ok(flat.includes("t:search"));
    assert.ok(flat.includes("t:i0"));
    assert.ok(kb.inline_keyboard[0]![0]!.text.includes("Shirt · M"));
  });

  it("product pick with cart offers continue", () => {
    const kb = productPickInline([], { cartCount: 2 });
    const flat = kb.inline_keyboard.flat().map((b) => b.callback_data);
    assert.ok(flat.includes("t:checkout"));
  });

  it("cart menu has add and checkout", () => {
    const data = JSON.stringify(cartMenuInline(2));
    assert.ok(data.includes("t:add"));
    assert.ok(data.includes("t:checkout"));
  });

  it("formatCartSummary lists lines", () => {
    const text = formatCartSummary([
      {
        productId: "p",
        productTitle: "Shirt",
        variantId: "v",
        variantTitle: "M",
        quantity: 2,
      },
    ]);
    assert.ok(text.includes("Shirt"));
    assert.ok(text.includes("2"));
  });

  it("matches main keyboard labels with emoji", () => {
    assert.equal(matchesMainLabel("🛒 New sale", MAIN_KEYBOARD_LABELS.newSale), true);
    assert.equal(matchesMainLabel("New sale", MAIN_KEYBOARD_LABELS.newSale), true);
  });

  it("distinguishes same product different variants", () => {
    const a = hitButtonLabel({
      productId: "p",
      productTitle: "Linen Midi Dress",
      variantId: "v1",
      variantTitle: "S",
      availableQuantity: 2,
    });
    const b = hitButtonLabel({
      productId: "p",
      productTitle: "Linen Midi Dress",
      variantId: "v2",
      variantTitle: "M",
      availableQuantity: 1,
    });
    assert.notEqual(a, b);
    assert.ok(a.includes("S"));
    assert.ok(b.includes("M"));
  });
});
