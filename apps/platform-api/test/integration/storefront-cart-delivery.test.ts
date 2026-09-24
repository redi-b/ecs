import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appWithResolution,
  resolvedTenantContext,
} from "../support/platform-app-harness.js";

describe("storefront cart and delivery", () => {
  it("injects the resolved tenant region when forwarding cart creation", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);
      return Response.json({ cart: { id: "cart_1" } }, { status: 201 });
    };
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      { medusaStoreFetch },
    );

    const response = await app.request("/store/carts", {
      method: "POST",
      body: JSON.stringify({ region_id: "reg_other", email: "buyer@example.com" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 201);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.deepEqual(JSON.parse(await forwardedRequest.text()), {
      region_id: "reg_1",
      email: "buyer@example.com",
    });
  });

  it("does not create carts for tenants without a commerce region", async () => {
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: {
          ...resolvedTenantContext,
          medusaRegionId: null,
        },
      },
      {
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/carts", {
      method: "POST",
      body: JSON.stringify({ email: "buyer@example.com" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "commerce_region_unavailable",
    });
    assert.equal(fetchCalls, 0);
  });

  it("returns public delivery options for the resolved storefront host", async () => {
    let deliveryInput: { tenantId: string } | undefined;
    let fetchCalls = 0;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        getDeliverySettings: async (input) => {
          deliveryInput = input;

          return {
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
              zones: [
                {
                  name: "Bole",
                  fee: "75.00",
                },
              ],
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
        medusaStoreFetch: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      },
    );

    const response = await app.request("/store/delivery", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(deliveryInput, {
      tenantId: "tenant_1",
    });
    assert.equal(fetchCalls, 0);
    assert.deepEqual(await response.json(), {
      delivery: {
        deliveryEnabled: true,
        pickupEnabled: true,
        phoneConfirmationRequired: true,
        notesEnabled: true,
        landmarkRequired: false,
        defaultDeliveryFee: "50.00",
        currency: "ETB",
        zones: [
          {
            name: "Bole",
            fee: "75.00",
          },
        ],
      },
    });
  });

  it("forwards cart shipping option reads to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        shipping_options: [
          {
            id: "so_1",
            name: "Local delivery",
            amount: 50,
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

    const response = await app.request("/store/shipping-options?cart_id=cart_1", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      shipping_options: [
        {
          id: "so_1",
          name: "Local delivery",
          amount: 50,
        },
      ],
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/shipping-options?cart_id=cart_1");
    assert.equal(forwardedRequest.headers.get("x-publishable-api-key"), "pk_1");
  });

  it("forwards cart shipping method selection to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        cart: {
          id: "cart_1",
          shipping_methods: [
            {
              shipping_option_id: "so_1",
            },
          ],
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

    const response = await app.request("/store/carts/cart_1/shipping-methods", {
      body: JSON.stringify({
        option_id: "so_1",
        data: {
          delivery_choice: "delivery",
        },
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      cart: {
        id: "cart_1",
        shipping_methods: [
          {
            shipping_option_id: "so_1",
          },
        ],
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1/shipping-methods");
    assert.equal(
      await forwardedRequest.text(),
      JSON.stringify({
        option_id: "so_1",
        data: {
          delivery_choice: "delivery",
        },
      }),
    );
  });

  it("forwards cart contact and address updates to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const medusaStoreFetch: typeof fetch = async (request) => {
      forwardedRequest = request instanceof Request ? request : new Request(request);

      return Response.json({
        cart: {
          id: "cart_1",
          email: "buyer@example.com",
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

    const body = {
      email: "buyer@example.com",
      shipping_address: {
        first_name: "Abebe",
        phone: "+251911111111",
        address_1: "Bole",
        city: "Addis Ababa",
        country_code: "et",
      },
      metadata: {
        delivery_choice: "delivery",
        landmark: "Near the mall",
        customer_notes: "Call before delivery",
      },
    };

    const response = await app.request("/store/carts/cart_1", {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      cart: {
        id: "cart_1",
        email: "buyer@example.com",
      },
    });
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.method, "POST");
    assert.equal(forwardedRequest.url, "http://medusa:9000/store/carts/cart_1");
    assert.equal(await forwardedRequest.text(), JSON.stringify(body));
  });
});
