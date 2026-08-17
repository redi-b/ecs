import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getLastOrderFromRequest,
  isLastOrderReceiptAuthorized,
  lastOrderSetCookie,
} from "./cart-cookie.js";

describe("last order receipt authorization", () => {
  it("authorizes only the order stored in the device receipt", () => {
    const setCookie = lastOrderSetCookie({
      id: "order_real",
      total: 31700,
      currencyCode: "etb",
    });
    const cookie = setCookie.split(";", 1)[0] ?? "";
    const receipt = getLastOrderFromRequest(
      new Request("http://shop.lvh.me/order/order_real", {
        headers: { cookie },
      }),
    );

    assert.equal(isLastOrderReceiptAuthorized("order_real", receipt), true);
    assert.equal(isLastOrderReceiptAuthorized("order_guessed", receipt), false);
    assert.equal(isLastOrderReceiptAuthorized("order_real", null), false);
  });
});
