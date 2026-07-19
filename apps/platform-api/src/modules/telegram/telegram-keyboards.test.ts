import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hitButtonLabel, productPickInline, qtyInline } from "./telegram-keyboards.js";

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
