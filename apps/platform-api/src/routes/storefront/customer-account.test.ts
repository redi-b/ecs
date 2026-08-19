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

  it("lists only the authenticated customer's saved addresses", async () => {
    let forwarded: Request | null = null;
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/addresses?limit=10&offset=2", {
        headers: { authorization: "Bearer customer_token" },
      }),
      medusaStoreFetch: async (request) => {
        forwarded = request instanceof Request ? request : new Request(request);
        return Response.json({ addresses: [{ id: "ca_1", address_1: "Bole Road" }], count: 1 });
      },
    });

    assert.equal(response?.status, 200);
    assert.ok(forwarded);
    assert.equal(new URL(forwarded.url).pathname, "/store/customers/me/addresses");
    assert.equal(new URL(forwarded.url).search, "?limit=10&offset=2");
    assert.equal(forwarded.headers.get("authorization"), "Bearer customer_token");
  });

  it("maps the bounded storefront address contract to Medusa", async () => {
    let forwarded: Request | null = null;
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/addresses", {
        body: JSON.stringify({
          addressName: "Home",
          firstName: "Liya",
          lastName: "Tadesse",
          phone: "+251911000000",
          address1: "Bole Road",
          city: "Addis Ababa",
          countryCode: "ET",
          isDefaultShipping: true,
        }),
        headers: { authorization: "Bearer customer_token", "content-type": "application/json" },
        method: "POST",
      }),
      medusaStoreFetch: async (request) => {
        forwarded = request instanceof Request ? request : new Request(request);
        return Response.json({ customer: { id: "cus_1", addresses: [{ id: "ca_1" }] } });
      },
    });

    assert.equal(response?.status, 200);
    assert.ok(forwarded);
    assert.equal(new URL(forwarded.url).pathname, "/store/customers/me/addresses");
    assert.equal(forwarded.method, "POST");
    assert.deepEqual(await forwarded.json(), {
      address_name: "Home",
      first_name: "Liya",
      last_name: "Tadesse",
      phone: "+251911000000",
      address_1: "Bole Road",
      address_2: null,
      city: "Addis Ababa",
      province: null,
      postal_code: null,
      country_code: "et",
      is_default_shipping: true,
    });
  });

  it("reuses an equivalent saved address instead of creating a duplicate", async () => {
    const forwarded: Request[] = [];
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/addresses", {
        body: JSON.stringify({
          addressName: "Another label",
          firstName: "Liya",
          lastName: "Tadesse",
          phone: "+251911000000",
          address1: "  Bole   Road ",
          city: "addis ababa",
          countryCode: "ET",
        }),
        headers: { authorization: "Bearer customer_token", "content-type": "application/json" },
        method: "POST",
      }),
      medusaStoreFetch: async (request) => {
        const captured = request instanceof Request ? request : new Request(request);
        forwarded.push(captured);
        return Response.json({ addresses: [{ id: "ca_1", address_1: "Bole Road", city: "Addis Ababa", country_code: "et" }] });
      },
    });

    assert.equal(response?.status, 200);
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0]?.method, "GET");
    assert.equal((await response?.json())?.reused, true);
  });

  it("rejects saved-address access without customer authentication", async () => {
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/addresses"),
      medusaStoreFetch: async () => { throw new Error("must not run"); },
    });
    assert.equal(response?.status, 401);
  });

  it("loads tenant-scoped commerce state for the authenticated customer id", async () => {
    let stateKey: unknown = null;
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/commerce-state", {
        headers: { authorization: "Bearer customer_token" },
      }),
      medusaStoreFetch: async () => Response.json({ customer: { id: "cus_1" } }),
      getCustomerCommerceState: async (key) => {
        stateKey = key;
        return { activeCartId: "cart_1", wishlist: [{ path: "/products/serum" }] };
      },
      updateCustomerCommerceState: async () => ({ activeCartId: null, wishlist: [] }),
    });

    assert.equal(response?.status, 200);
    assert.deepEqual(stateKey, { customerId: "cus_1", tenantId: "tenant_shop" });
    assert.deepEqual(await response?.json(), {
      state: { activeCartId: "cart_1", wishlist: [{ path: "/products/serum" }] },
    });
  });

  it("associates and remembers only the explicitly submitted browser cart", async () => {
    const paths: string[] = [];
    let update: unknown = null;
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/cart", {
        body: JSON.stringify({ cartId: "cart_browser" }),
        headers: { authorization: "Bearer customer_token", "content-type": "application/json" },
        method: "POST",
      }),
      medusaStoreFetch: async (request) => {
        const forwarded = request instanceof Request ? request : new Request(request);
        paths.push(new URL(forwarded.url).pathname);
        return paths.length === 1
          ? Response.json({ customer: { id: "cus_1" } })
          : Response.json({ cart: { id: "cart_browser" } });
      },
      getCustomerCommerceState: async () => ({ activeCartId: null, wishlist: [] }),
      updateCustomerCommerceState: async (key, values) => {
        update = { key, values };
        return { activeCartId: "cart_browser", wishlist: [] };
      },
    });

    assert.equal(response?.status, 200);
    assert.deepEqual(paths, ["/store/customers/me", "/store/carts/cart_browser/customer"]);
    assert.deepEqual(update, {
      key: { customerId: "cus_1", tenantId: "tenant_shop" },
      values: { activeCartId: "cart_browser" },
    });
  });

  it("merges a remembered cart into the submitted browser cart before switching", async () => {
    const requests: Array<{ body: unknown; method: string; path: string }> = [];
    let update: unknown = null;
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/cart", {
        body: JSON.stringify({ cartId: "cart_browser" }),
        headers: { authorization: "Bearer customer_token", "content-type": "application/json" },
        method: "POST",
      }),
      medusaStoreFetch: async (request) => {
        const forwarded = request instanceof Request ? request : new Request(request);
        const path = new URL(forwarded.url).pathname;
        const body = forwarded.method === "GET" ? null : await forwarded.clone().json().catch(() => null);
        requests.push({ body, method: forwarded.method, path });
        if (path === "/store/customers/me") return Response.json({ customer: { id: "cus_1" } });
        if (path === "/store/carts/cart_remembered") {
          return Response.json({ cart: { id: "cart_remembered", items: [
            { id: "item_old", quantity: 2, variant_id: "variant_shared" },
            { id: "item_missing", quantity: 1, variant_id: "variant_missing" },
          ] } });
        }
        if (path === "/store/carts/cart_browser") {
          return Response.json({ cart: { id: "cart_browser", items: [
            { id: "item_new", quantity: 1, variant_id: "variant_shared" },
          ] } });
        }
        return Response.json({ cart: { id: "cart_browser" } });
      },
      getCustomerCommerceState: async () => ({ activeCartId: "cart_remembered", wishlist: [] }),
      updateCustomerCommerceState: async (key, values) => {
        update = { key, values };
        return { activeCartId: "cart_browser", wishlist: [] };
      },
    });

    assert.equal(response?.status, 200);
    assert.deepEqual(requests.map(({ method, path }) => `${method} ${path}`), [
      "GET /store/customers/me",
      "GET /store/carts/cart_remembered",
      "GET /store/carts/cart_browser",
      "POST /store/carts/cart_browser/line-items/item_new",
      "POST /store/carts/cart_browser/line-items",
      "POST /store/carts/cart_browser/customer",
    ]);
    assert.deepEqual(requests[3]?.body, { quantity: 2 });
    assert.deepEqual(requests[4]?.body, { variant_id: "variant_missing", quantity: 1 });
    assert.deepEqual(update, {
      key: { customerId: "cus_1", tenantId: "tenant_shop" },
      values: { activeCartId: "cart_browser" },
    });
  });

  it("does not switch the remembered cart when reconciliation fails", async () => {
    let updateCalls = 0;
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/cart", {
        body: JSON.stringify({ cartId: "cart_browser" }),
        headers: { authorization: "Bearer customer_token", "content-type": "application/json" },
        method: "POST",
      }),
      medusaStoreFetch: async (request) => {
        const forwarded = request instanceof Request ? request : new Request(request);
        const path = new URL(forwarded.url).pathname;
        if (path === "/store/customers/me") return Response.json({ customer: { id: "cus_1" } });
        if (path === "/store/carts/cart_remembered") {
          return Response.json({ cart: { id: "cart_remembered", items: [
            { id: "item_old", quantity: 1, variant_id: "variant_missing" },
          ] } });
        }
        if (path === "/store/carts/cart_browser") {
          return Response.json({ cart: { id: "cart_browser", items: [] } });
        }
        return Response.json({ message: "merge rejected" }, { status: 409 });
      },
      getCustomerCommerceState: async () => ({ activeCartId: "cart_remembered", wishlist: [] }),
      updateCustomerCommerceState: async () => {
        updateCalls += 1;
        return { activeCartId: "cart_browser", wishlist: [] };
      },
    });

    assert.equal(response?.status, 409);
    assert.equal(updateCalls, 0);
    assert.deepEqual(await response?.json(), { error: "customer_cart_merge_failed" });
  });

  it("does not expose commerce state without customer authentication", async () => {
    const response = await handleCustomerAccountRequest({
      ...base,
      request: new Request("http://shop.test/store/customer/commerce-state"),
      medusaStoreFetch: async () => { throw new Error("must not run"); },
    });
    assert.equal(response?.status, 401);
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
