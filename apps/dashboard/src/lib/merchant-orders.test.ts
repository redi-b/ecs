import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMerchantOrder, getMerchantOrders } from "./merchant-orders.js";

describe("getMerchantOrders", () => {
  it("fetches merchant orders with session and tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantOrders({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      limit: 5,
      offset: 10,
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          orders: [
            {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "awaiting",
              fulfillmentStatus: "not_fulfilled",
              currencyCode: "etb",
              total: 1250,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
          count: 1,
          limit: 5,
          offset: 10,
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/orders?limit=5&offset=10",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("returns an error for invalid order responses", async () => {
    const result = await getMerchantOrders({
      platformApiBaseUrl: "http://platform.local",
      fetcher: async () => Response.json({ orders: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_orders_response",
    });
  });

  it("returns an error when the order request fails", async () => {
    const result = await getMerchantOrders({
      platformApiBaseUrl: "http://platform.local",
      fetcher: async () => {
        throw new TypeError("fetch failed");
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    });
  });
});

describe("getMerchantOrder", () => {
  it("fetches a merchant order detail with session and tenant context", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantOrder({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      tenantId: "tenant_1",
      orderId: "order_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          order: {
            id: "order_1",
            displayId: 1001,
            email: "customer@example.com",
            status: "pending",
            paymentStatus: "awaiting",
            fulfillmentStatus: "not_fulfilled",
            currencyCode: "etb",
            total: 1250,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/tenants/tenant_1/orders/order_1",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), null);
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("fetches a merchant order detail with forwarded host when tenant context is absent", async () => {
    let forwardedRequest: Request | undefined;
    const result = await getMerchantOrder({
      cookieHeader: "better-auth.session_token=session_1",
      platformApiBaseUrl: "http://platform.local",
      requestHost: "merchant.example.com",
      orderId: "order_1",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          order: {
            id: "order_1",
            displayId: 1001,
            email: "customer@example.com",
            status: "pending",
            paymentStatus: "awaiting",
            fulfillmentStatus: "not_fulfilled",
            currencyCode: "etb",
            total: 1250,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      forwardedRequest?.url,
      "http://platform.local/platform/merchant/orders/order_1",
    );
    assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "merchant.example.com");
    assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  });

  it("returns an error for invalid order detail responses", async () => {
    const result = await getMerchantOrder({
      platformApiBaseUrl: "http://platform.local",
      orderId: "order_1",
      fetcher: async () => Response.json({ order: null }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 502,
      message: "invalid_order_response",
    });
  });

  it("returns an error when the order detail request fails", async () => {
    const result = await getMerchantOrder({
      platformApiBaseUrl: "http://platform.local",
      orderId: "order_1",
      fetcher: async () => {
        throw new TypeError("fetch failed");
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    });
  });
});
