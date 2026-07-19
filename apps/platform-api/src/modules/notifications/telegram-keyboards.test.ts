import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { productPickInline, qtyInline } from "./telegram-keyboards.js";

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
  });
});
