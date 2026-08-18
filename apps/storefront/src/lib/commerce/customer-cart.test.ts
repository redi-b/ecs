import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  associateCartWithCustomer,
  associateRequestCartWithCustomer,
} from "./customer-cart.js";

const context = {
  cartId: "cart_1",
  platformApiBaseUrl: "http://platform.test",
  requestHost: "shop.test",
};

describe("customer cart association", () => {
  it("does not claim a guest cart without an authenticated session", async () => {
    let requests = 0;
    const result = await associateRequestCartWithCustomer(
      new Request("http://shop.test/checkout"),
      context,
    );

    assert.deepEqual(result, { ok: true, authenticated: false });
    assert.equal(requests, 0);
  });

  it("associates the exact browser cart using the customer token", async () => {
    let forwarded: Request | null = null;
    const result = await associateCartWithCustomer({
      ...context,
      token: "customer_token",
      fetcher: async (request) => {
        forwarded = request instanceof Request ? request : new Request(request);
        return Response.json({ cart: { id: "cart_1" } });
      },
    });

    assert.deepEqual(result, { ok: true, authenticated: true });
    assert.equal(new URL(forwarded!.url).pathname, "/store/customer/cart");
    assert.equal(forwarded!.headers.get("authorization"), "Bearer customer_token");
  });

  it("fails closed without discarding the browser cart", async () => {
    const result = await associateCartWithCustomer({
      ...context,
      token: "customer_token",
      fetcher: async () => Response.json({ error: "cart_conflict" }, { status: 409 }),
    });

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /cart is safe/i);
  });
});
