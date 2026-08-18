import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleCustomerAccountRequest } from "./customer-account.js";

const base = {
  medusaInternalUrl: "http://medusa:9000",
  medusaPublishableKey: "pk_shop",
  medusaSalesChannelId: "sc_shop",
  tenantId: "tenant_shop",
};

it("projects a registered storefront customer into the tenant customer group", async () => {
  const projected: Array<Record<string, unknown>> = [];
  let authCalls = 0;
  const response = await handleCustomerAccountRequest({
    ...base,
    ensureTenantCustomer: async (input) => { projected.push(input); return { ok: true }; },
    request: new Request("http://shop.test/store/customer-auth/register", {
      body: JSON.stringify({ email: "person@example.com", firstName: "Liya", lastName: "Tadesse", password: "password1" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
    medusaStoreFetch: async (request) => {
      const forwarded = request instanceof Request ? request : new Request(request);
      const path = new URL(forwarded.url).pathname;
      if (path === "/auth/customer/emailpass/register") return Response.json({ token: "registration_token" });
      if (path === "/store/customers") return Response.json({ customer: { id: "cus_1" } });
      authCalls += 1;
      return Response.json({ token: "session_token" });
    },
  });
  assert.equal(response?.status, 200);
  assert.equal(authCalls, 1);
  assert.deepEqual(projected, [{ email: "person@example.com", firstName: "Liya", lastName: "Tadesse", tenantId: "tenant_shop" }]);
});

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

  it("updates only the authenticated customer's supported profile fields", async () => {
    let forwarded: Request | null = null;
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/profile", {
        body: JSON.stringify({ firstName: "Liya", lastName: "Tadesse", phone: "+251911000000" }),
        headers: { authorization: "Bearer customer_token", "content-type": "application/json" },
        method: "POST",
      }),
      medusaStoreFetch: async (request) => {
        forwarded = request instanceof Request ? request : new Request(request);
        return Response.json({ customer: { id: "cus_1", email: "customer@example.com" } });
      },
    });

    assert.equal(response?.status, 200);
    assert.ok(forwarded);
    assert.equal(forwarded.method, "POST");
    assert.equal(new URL(forwarded.url).pathname, "/store/customers/me");
    assert.equal(forwarded.headers.get("authorization"), "Bearer customer_token");
    assert.deepEqual(await forwarded.json(), {
      first_name: "Liya",
      last_name: "Tadesse",
      phone: "+251911000000",
    });
  });

  it("returns an authenticated order only when it belongs to the resolved shop", async () => {
    let forwarded: Request | null = null;
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/orders/order_here", {
        headers: { authorization: "Bearer customer_token" },
      }),
      medusaStoreFetch: async (request) => {
        forwarded = request instanceof Request ? request : new Request(request);
        return Response.json({ order: { id: "order_here", sales_channel_id: "sc_shop" } });
      },
    });

    assert.equal(response?.status, 200);
    assert.ok(forwarded);
    assert.equal(new URL(forwarded.url).pathname, "/store/orders/order_here");
    assert.equal(forwarded.headers.get("authorization"), "Bearer customer_token");
    assert.deepEqual(await response?.json(), {
      order: { id: "order_here", sales_channel_id: "sc_shop" },
    });
  });

  it("does not expose an authenticated customer's order from another shop", async () => {
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/orders/order_elsewhere", {
        headers: { authorization: "Bearer customer_token" },
      }),
      medusaStoreFetch: async () => Response.json({
        order: { id: "order_elsewhere", sales_channel_id: "sc_other" },
      }),
    });

    assert.equal(response?.status, 404);
    assert.deepEqual(await response?.json(), { error: "customer_order_not_found" });
  });
});
