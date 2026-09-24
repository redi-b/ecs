import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appWithResolution,
  type NotificationEventType,
  resolvedTenantContext,
} from "../support/platform-app-harness.js";

describe("storefront payment and checkout", () => {
  it("forwards payment provider reads to Medusa with the resolved tenant region", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        payment_providers: [
          {
            id: "pp_system_default",
          },
        ],
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/payment-providers?region_id=reg_other", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      payment_providers: [
        {
          id: "pp_system_default",
        },
      ],
    });
    assert.ok(forwardedRequest);
    assert.equal(
      forwardedRequest.url,
      "http://medusa:9000/store/payment-providers?region_id=reg_1",
    );
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
  });

  it("completes a COD checkout through Medusa with tenant delivery metadata", async () => {
    const forwardedRequests: Request[] = [];
    const notificationEvents: {
      eventType: NotificationEventType;
      payload?: unknown;
      tenantId: string;
    }[] = [];
    const analyticsEvents: {
      eventType: string;
      idempotencyKey?: string | null | undefined;
      properties?: unknown;
      source: "medusa" | "platform" | "storefront";
      subjectId?: string | null | undefined;
      subjectType?: string | null | undefined;
      tenantId: string;
    }[] = [];
    const medusaStoreFetch: typeof fetch = async (request) => {
      const forwardedRequest = request instanceof Request ? request : new Request(request);
      forwardedRequests.push(forwardedRequest.clone());
      const path = new URL(forwardedRequest.url).pathname;

      if (forwardedRequest.method === "GET" && path === "/store/carts/cart_1") {
        return Response.json({
          cart: {
            id: "cart_1",
            items: [{ id: "item_1", variant: { id: "variant_1" } }],
          },
        });
      }

      if (path === "/store/payment-collections") {
        return Response.json({
          payment_collection: {
            id: "paycol_1",
          },
        });
      }

      if (path === "/store/carts/cart_1/complete") {
        return Response.json({
          type: "order",
          order: {
            id: "order_1",
          },
        });
      }

      return Response.json({
        cart: {
          id: "cart_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => ({
          ok: true,
          delivery: {
            tenantId: input.tenantId,
            deliveryEnabled: true,
            pickupEnabled: true,
            phoneConfirmationRequired: true,
            notesEnabled: true,
            landmarkRequired: true,
            defaultDeliveryFee: "50.00",
            currency: "ETB",
            zones: [],
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        }),
        medusaStoreFetch,
        recordNotificationEvent: async (input) => {
          notificationEvents.push(input);

          return {
            ok: true,
            logCount: 1,
            logIds: ["log_1"],
          };
        },
        recordAnalyticsEvent: async (input) => {
          analyticsEvents.push(input);

          return {
            ok: true,
            duplicate: false,
            event: {
              id: "event_1",
              eventType: input.eventType,
              occurredAt: "2026-01-01T12:00:00.000Z",
              receivedAt: "2026-01-01T12:00:01.000Z",
              source: input.source,
            },
          };
        },
      },
    );

    const response = await app.request("/store/checkout/cod", {
      body: JSON.stringify({
        cartId: "cart_1",
        shippingOptionId: "so_1",
        deliveryChoice: "delivery",
        customer: {
          name: "Abebe Kebede",
          phone: "+251911111111",
          email: "buyer@example.com",
        },
        address: {
          address1: "Bole Road",
          city: "Addis Ababa",
          landmark: "Near the mall",
        },
        notes: "Call before delivery",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      type: "order",
      order: {
        id: "order_1",
      },
    });
    assert.equal(forwardedRequests.length, 6);
    const updateCartRequest = forwardedRequests[1];
    const shippingMethodRequest = forwardedRequests[2];
    const paymentCollectionRequest = forwardedRequests[3];
    const paymentSessionRequest = forwardedRequests[4];

    assert.ok(updateCartRequest);
    assert.ok(shippingMethodRequest);
    assert.ok(paymentCollectionRequest);
    assert.ok(paymentSessionRequest);
    assert.deepEqual(
      forwardedRequests.map((request) => [request.method, new URL(request.url).pathname]),
      [
        ["GET", "/store/carts/cart_1"],
        ["POST", "/store/carts/cart_1"],
        ["POST", "/store/carts/cart_1/shipping-methods"],
        ["POST", "/store/payment-collections"],
        ["POST", "/store/payment-collections/paycol_1/payment-sessions"],
        ["POST", "/store/carts/cart_1/complete"],
      ],
    );
    assert.equal(updateCartRequest.headers.get("x-publishable-api-key"), "pk_1");
    assert.deepEqual(JSON.parse(await updateCartRequest.text()), {
      email: "buyer@example.com",
      shipping_address: {
        first_name: "Abebe Kebede",
        phone: "+251911111111",
        address_1: "Bole Road",
        city: "Addis Ababa",
        country_code: "et",
      },
      metadata: {
        checkout_type: "cod",
        payment_method: "cod",
        delivery_choice: "delivery",
        customer_name: "Abebe Kebede",
        customer_phone: "+251911111111",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    });
    assert.deepEqual(JSON.parse(await shippingMethodRequest.text()), {
      option_id: "so_1",
      data: {
        delivery_choice: "delivery",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    });
    assert.deepEqual(JSON.parse(await paymentCollectionRequest.text()), {
      cart_id: "cart_1",
    });
    assert.deepEqual(JSON.parse(await paymentSessionRequest.text()), {
      provider_id: "pp_system_default",
      data: {
        payment_method: "cod",
      },
    });
    // Medusa's order.placed subscriber is the sole notification emitter.
    assert.deepEqual(notificationEvents, []);
    assert.deepEqual(analyticsEvents, [
      {
        eventType: "order.created",
        idempotencyKey: "cod:cart_1:order.created",
        properties: {
          cartId: "cart_1",
          deliveryChoice: "delivery",
          orderId: "order_1",
          paymentMethod: "cod",
        },
        source: "platform",
        subjectId: "order_1",
        subjectType: "order",
        tenantId: "tenant_1",
      },
    ]);
  });

  it("rejects a stale COD cart before starting checkout completion", async () => {
    const forwardedRequests: Request[] = [];
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => ({
          ok: true,
          delivery: {
            tenantId: input.tenantId,
            deliveryEnabled: true,
            pickupEnabled: true,
            phoneConfirmationRequired: true,
            notesEnabled: true,
            landmarkRequired: false,
            defaultDeliveryFee: "50.00",
            currency: "ETB",
            zones: [],
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        }),
        medusaStoreFetch: async (request) => {
          const forwardedRequest = request instanceof Request ? request : new Request(request);
          forwardedRequests.push(forwardedRequest.clone());
          return Response.json({
            cart: {
              id: "cart_stale",
              items: [{ id: "item_stale", requires_shipping: true, variant: null }],
            },
          });
        },
      },
    );

    const response = await app.request("/store/checkout/cod", {
      body: JSON.stringify({
        cartId: "cart_stale",
        shippingOptionId: "so_1",
        deliveryChoice: "delivery",
        customer: { name: "Abebe Kebede", phone: "+251911111111" },
        address: { address1: "Bole Road", city: "Addis Ababa" },
      }),
      headers: { "content-type": "application/json", Host: "abebe.lvh.me" },
      method: "POST",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "cart_items_unavailable" });
    assert.equal(forwardedRequests.length, 1);
    assert.equal(forwardedRequests[0]?.method, "GET");
  });

  it("rejects store Chapa checkout when merchant credentials are missing", async () => {
    let medusaCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getMerchantChapaCredentials: async () => ({
          ok: false as const,
          error: "merchant_chapa_not_configured" as const,
        }),
        medusaStoreFetch: async () => {
          medusaCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/checkout/chapa", {
      body: JSON.stringify({
        cartId: "cart_1",
        returnUrl: "http://abebe.lvh.me/checkout/return",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "merchant_chapa_not_configured",
    });
    assert.equal(medusaCalls, 0);
  });

  it("returns payment options with chapa only when merchant credentials exist", async () => {
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        isMerchantChapaConfigured: async () => true,
      },
    );

    const response = await app.request("/store/payment-options", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      payment: {
        cod: true,
        chapa: true,
      },
    });
  });

  it("does not complete COD checkout when tenant delivery is disabled", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => ({
          ok: true,
          delivery: {
            tenantId: input.tenantId,
            deliveryEnabled: false,
            pickupEnabled: true,
            phoneConfirmationRequired: true,
            notesEnabled: true,
            landmarkRequired: false,
            defaultDeliveryFee: "50.00",
            currency: "ETB",
            zones: [],
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        }),
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/checkout/cod", {
      body: JSON.stringify({
        cartId: "cart_1",
        shippingOptionId: "so_1",
        deliveryChoice: "delivery",
        customer: {
          name: "Abebe Kebede",
          phone: "+251911111111",
        },
        address: {
          address1: "Bole Road",
          city: "Addis Ababa",
        },
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "delivery_unavailable",
    });
    assert.equal(fetchCalls, 0);
  });

  it("forwards payment session initialization to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        payment_collection: {
          id: "paycol_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/payment-collections/paycol_1/payment-sessions", {
      body: JSON.stringify({
        provider_id: "pp_system_default",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      payment_collection: {
        id: "paycol_1",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(
      forwardedRequest.url,
      "http://medusa:9000/store/payment-collections/paycol_1/payment-sessions",
    );
    assert.equal(
      await forwardedRequest.text(),
      JSON.stringify({
        provider_id: "pp_system_default",
      }),
    );
  });

  it("forwards cart completion to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        type: "order",
        order: {
          id: "order_1",
        },
      });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts/cart_1/complete", {
      headers: {
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      type: "order",
      order: {
        id: "order_1",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1/complete");
  });
});
