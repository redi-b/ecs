import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleCustomerAccountRequest } from "./customer-account.js";

const base = {
  medusaInternalUrl: "http://medusa:9000",
  medusaPublishableKey: "pk_shop",
  medusaSalesChannelId: "sc_shop",
};

describe("storefront customer account boundary", () => {
  it("returns only the auth token and applies the tenant publishable key", async () => {
    let forwardedUrl = "";
    let forwardedKey = "";
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer-auth/login", {
        body: JSON.stringify({ email: "person@example.com", password: "password1" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      medusaStoreFetch: async (request) => {
        const forwarded = request instanceof Request ? request : new Request(request);
        forwardedUrl = forwarded.url;
        forwardedKey = forwarded.headers.get("x-publishable-api-key") ?? "";
        return Response.json({ token: "jwt_secret", extra: "hidden" });
      },
    });
    assert.equal(response?.status, 200);
    assert.deepEqual(await response?.json(), { token: "jwt_secret" });
    assert.equal(forwardedKey, "pk_shop");
    assert.equal(new URL(forwardedUrl).pathname, "/auth/customer/emailpass");
  });

  it("filters authenticated history to the resolved shop sales channel", async () => {
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/orders", {
        headers: { authorization: "Bearer customer_token" },
      }),
      medusaStoreFetch: async () => Response.json({
        orders: [
          { id: "order_here", sales_channel_id: "sc_shop" },
          { id: "order_elsewhere", sales_channel_id: "sc_other" },
        ],
        count: 2,
        limit: 20,
        offset: 0,
      }),
    });
    assert.deepEqual(await response?.json(), {
      orders: [{ id: "order_here", sales_channel_id: "sc_shop" }],
      count: 1,
      limit: 20,
      offset: 0,
    });
  });

  it("never returns history without a customer token", async () => {
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/orders"),
      medusaStoreFetch: async () => { throw new Error("must not run"); },
    });
    assert.equal(response?.status, 401);
  });
});
