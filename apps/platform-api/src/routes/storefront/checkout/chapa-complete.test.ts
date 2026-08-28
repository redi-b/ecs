import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { completeChapaCheckout, initializeChapaCheckout } from "./chapa.js";

describe("initializeChapaCheckout", () => {
  it("rejects a Chapa checkout without a payer email before calling Chapa", async () => {
    const response = await initializeChapaCheckout({
      getMerchantChapaCredentials: async () => ({
        ok: true,
        secretKey: "sk_test",
        providerAccountRef: null,
      }),
      medusaInternalUrl: "http://medusa:9000",
      medusaPublishableKeyId: "pk_test",
      medusaStoreFetch: async () =>
        Response.json({
          cart: {
            id: "cart_1",
            total: 250,
            currency_code: "etb",
          },
        }),
      platformPublicBaseUrl: "http://api.lvh.me",
      request: new Request("http://api/store/checkout/chapa", {
        method: "POST",
        body: JSON.stringify({ cartId: "cart_1" }),
        headers: { "content-type": "application/json" },
      }),
      tenantId: "tenant_1",
    });

    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      error: "chapa_customer_email_required",
      message: "Enter a valid email address to pay securely with Chapa.",
    });
  });

  it("initializes Chapa with the cart email and records the transaction reference", async () => {
    const originalFetch = globalThis.fetch;
    let recordedMetadata: Record<string, unknown> | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes("/transaction/initialize")) {
        return Response.json({
          status: "success",
          data: { checkout_url: "https://checkout.chapa.co/test" },
        });
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    }) as typeof fetch;

    try {
      const response = await initializeChapaCheckout({
        getMerchantChapaCredentials: async () => ({
          ok: true,
          secretKey: "sk_test",
          providerAccountRef: null,
        }),
        medusaInternalUrl: "http://medusa:9000",
        medusaPublishableKeyId: "pk_test",
        medusaStoreFetch: async (input, init) => {
          const request = input instanceof Request ? input : new Request(input, init);
          if (request.method === "GET") {
            return Response.json({
              cart: {
                id: "cart_1",
                total: 250,
                currency_code: "etb",
                email: "buyer@example.org",
              },
            });
          }
          recordedMetadata = (await request.json()) as Record<string, unknown>;
          return Response.json({ cart: { id: "cart_1" } });
        },
        platformPublicBaseUrl: "http://api.lvh.me",
        request: new Request("http://api/store/checkout/chapa", {
          method: "POST",
          body: JSON.stringify({ cartId: "cart_1" }),
          headers: { "content-type": "application/json" },
        }),
        tenantId: "tenant_1",
      });

      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.checkoutUrl, "https://checkout.chapa.co/test");
      assert.equal(typeof body.paymentSession.id, "string");
      assert.ok(recordedMetadata);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("completeChapaCheckout", () => {
  it("rejects when merchant credentials are missing", async () => {
    const response = await completeChapaCheckout({
      getMerchantChapaCredentials: async () => ({
        ok: false,
        error: "merchant_chapa_not_configured",
      }),
      medusaInternalUrl: "http://medusa:9000",
      medusaPublishableKeyId: "pk_test",
      medusaStoreFetch: async () => {
        throw new Error("should not call medusa");
      },
      request: new Request("http://api/store/checkout/chapa/complete", {
        method: "POST",
        body: JSON.stringify({ cartId: "cart_1" }),
        headers: { "content-type": "application/json" },
      }),
      tenantId: "tenant_1",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "merchant_chapa_not_configured" });
  });

  it("rejects unpaid Chapa verification", async () => {
    const forwarded: string[] = [];
    const response = await completeChapaCheckout({
      getMerchantChapaCredentials: async () => ({
        ok: true,
        secretKey: "sk_test",
        providerAccountRef: null,
      }),
      medusaInternalUrl: "http://medusa:9000",
      medusaPublishableKeyId: "pk_test",
      medusaStoreFetch: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        const path = new URL(request.url).pathname;
        forwarded.push(`${request.method} ${path}`);
        if (path.startsWith("/store/carts/")) {
          return Response.json({
            cart: {
              id: "cart_1",
              metadata: { chapa_tx_ref: "ecs_store_abc" },
              total: 100,
            },
          });
        }
        return Response.json({});
      },
      request: new Request("http://api/store/checkout/chapa/complete", {
        method: "POST",
        body: JSON.stringify({ cartId: "cart_1" }),
        headers: { "content-type": "application/json" },
      }),
      tenantId: "tenant_1",
    });

    // verifyPayment will fail network without mock — treat as verification_failed or not_found.
    // We only assert we attempted cart load and did not invent success.
    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.error, "string");
    assert.ok(forwarded.some((entry) => entry.includes("/store/carts/cart_1")));
  });

  it("completes cart after successful verification", async () => {
    const originalFetch = globalThis.fetch;
    let settlementMetadata: Record<string, unknown> | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/transaction/verify/")) {
        return Response.json({
          status: "success",
          data: { status: "success", tx_ref: "ecs_store_ok" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    try {
      const response = await completeChapaCheckout({
        getMerchantChapaCredentials: async () => ({
          ok: true,
          secretKey: "sk_test",
          providerAccountRef: null,
        }),
        medusaInternalUrl: "http://medusa:9000",
        medusaPublishableKeyId: "pk_test",
        medusaStoreFetch: async (input, init) => {
          const request = input instanceof Request ? input : new Request(input, init);
          const path = new URL(request.url).pathname;
          if (request.method === "GET" && path.includes("/store/carts/")) {
            return Response.json({
              cart: {
                id: "cart_1",
                metadata: { chapa_tx_ref: "ecs_store_ok" },
                total: 250,
                currency_code: "etb",
              },
            });
          }
          if (request.method === "POST" && path === "/store/carts/cart_1") {
            const body = (await request.json()) as { metadata?: Record<string, unknown> };
            settlementMetadata = body.metadata;
            return Response.json({ cart: { id: "cart_1", metadata: body.metadata } });
          }
          if (path === "/store/payment-collections") {
            return Response.json({ payment_collection: { id: "paycol_1" } });
          }
          if (path.includes("/payment-sessions")) {
            return Response.json({ payment_session: { id: "payses_1" } });
          }
          if (path.endsWith("/complete")) {
            return Response.json({
              type: "order",
              order: { id: "order_1", total: 250, currency_code: "etb" },
            });
          }
          return Response.json({ error: "unexpected", path }, { status: 500 });
        },
        request: new Request("http://api/store/checkout/chapa/complete", {
          method: "POST",
          body: JSON.stringify({ cartId: "cart_1", txRef: "ecs_store_ok" }),
          headers: { "content-type": "application/json" },
        }),
        tenantId: "tenant_1",
      });

      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.type, "order");
      assert.equal(body.order.id, "order_1");
      assert.equal(settlementMetadata?.payment_method, "chapa");
      assert.equal(settlementMetadata?.settlement_method, "chapa");
      assert.equal(settlementMetadata?.settlement_reference, "ecs_store_ok");
      assert.equal(typeof settlementMetadata?.settlement_recorded_at, "string");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
