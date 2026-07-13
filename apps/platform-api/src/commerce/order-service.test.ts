import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMedusaOrderService } from "./order-service.js";

describe("createMedusaOrderService", () => {
  it("lists orders through the Medusa Admin API scoped by sales channel", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          orders: [
            {
              id: "order_1",
              display_id: 1001,
              email: "customer@example.com",
              customer_id: "cus_1",
              status: "pending",
              payment_status: "awaiting",
              fulfillment_status: "not_fulfilled",
              currency_code: "etb",
              total: 1250,
              sales_channel_id: "sc_1",
              metadata: {
                payment_method: "cod",
                delivery_choice: "delivery",
                customer_name: "Abebe Kebede",
              },
              items: [{ id: "item_1", title: "Phone case", quantity: 2, unit_price: 625, total: 1250 }],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
            {
              id: "order_other",
              sales_channel_id: "sc_other",
            },
          ],
          count: 1,
          limit: 10,
          offset: 5,
        });
      },
    });

    const result = await service.listMerchantOrders({
      limit: 10,
      offset: 5,
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.headers.get("authorization"), "Basic medusa_token");

    const url = new URL(forwardedRequest.url);
    assert.equal(url.origin + url.pathname, "http://medusa:9000/admin/orders");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("offset"), "5");
    assert.equal(url.searchParams.get("order"), "-created_at");
    assert.equal(url.searchParams.get("sales_channel_id[]"), "sc_1");
    assert.match(url.searchParams.get("fields") ?? "", /customer_id/);
    assert.match(url.searchParams.get("fields") ?? "", /\*items/);
    assert.deepEqual(result, {
      ok: true,
      orders: [
        {
          id: "order_1",
          displayId: 1001,
          email: "customer@example.com",
          customerId: "cus_1",
          status: "pending",
          paymentStatus: "awaiting",
          fulfillmentStatus: "not_fulfilled",
          paymentMethod: "cod",
          paymentReference: null,
          note: null,
          currencyCode: "etb",
          total: 1250,
          subtotal: null,
          shippingTotal: null,
          discountTotal: null,
          itemCount: 2,
          delivery: {
            choice: "delivery",
            customerName: "Abebe Kebede",
            customerPhone: null,
            landmark: null,
            notes: null,
          },
          items: [
            {
              id: "item_1",
              title: "Phone case",
              quantity: 2,
              unitPrice: 625,
              total: 1250,
              thumbnail: null,
            },
          ],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      // Channel isolation drops the foreign order; count falls back to filtered length.
      count: 1,
      limit: 10,
      offset: 5,
    });
  });

  it("forwards payment and date list filters to Medusa", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);
        return Response.json({ orders: [], count: 0, limit: 20, offset: 0 });
      },
    });

    const result = await service.listMerchantOrders({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
      paymentStatus: "unpaid",
      createdFrom: "2026-07-01T00:00:00.000Z",
      createdTo: "2026-07-13T00:00:00.000Z",
      q: "abebe",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    const url = new URL(forwardedRequest.url);
    assert.equal(url.searchParams.get("q"), "abebe");
    assert.ok(url.searchParams.getAll("payment_status[]").includes("not_paid"));
    assert.equal(url.searchParams.get("created_at[$gte]"), "2026-07-01T00:00:00.000Z");
    assert.equal(url.searchParams.get("created_at[$lte]"), "2026-07-13T00:00:00.000Z");
  });

  it("post-filters payment method for list results", async () => {
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () =>
        Response.json({
          orders: [
            {
              id: "order_cod",
              status: "pending",
              payment_status: "not_paid",
              fulfillment_status: "not_fulfilled",
              sales_channel_id: "sc_1",
              metadata: { payment_method: "cod" },
            },
            {
              id: "order_chapa",
              status: "pending",
              payment_status: "captured",
              fulfillment_status: "not_fulfilled",
              sales_channel_id: "sc_1",
              metadata: { payment_method: "chapa" },
            },
          ],
          count: 2,
          limit: 50,
          offset: 0,
        }),
    });

    const result = await service.listMerchantOrders({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
      paymentMethod: "cod",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.orders.length, 1);
    assert.equal(result.orders[0]?.id, "order_cod");
    assert.equal(result.count, 1);
  });

  it("gets one order through the Medusa Admin API scoped by sales channel", async () => {
    let forwardedRequest: Request | undefined;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        forwardedRequest = new Request(input, init);

        return Response.json({
          order: {
            id: "order_1",
            display_id: 1001,
            email: "customer@example.com",
            status: "pending",
            payment_status: "awaiting",
            fulfillment_status: "not_fulfilled",
            currency_code: "etb",
            total: 1250,
            sales_channel_id: "sc_1",
            metadata: {
              delivery_choice: "delivery",
              customer_name: "Abebe Kebede",
              customer_phone: "+251911111111",
              landmark: "Blue gate",
              customer_notes: "Call before arrival",
            },
            shipping_address: {
              first_name: "Abebe",
              last_name: "Kebede",
              phone: "+251911111111",
              address_1: "Bole Road",
              address_2: "Apartment 4",
              city: "Addis Ababa",
              province: "Addis Ababa",
              postal_code: "1000",
              country_code: "et",
            },
            fulfillments: [
              {
                id: "ful_1",
                delivered_at: null,
                shipped_at: "2026-01-02T10:00:00.000Z",
                canceled_at: null,
              },
            ],
            items: [
              {
                id: "item_1",
                title: "Coffee",
                quantity: 2,
                unit_price: 500,
                total: 1000,
                thumbnail: null,
              },
            ],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.getMerchantOrder({
      orderId: "order_1",
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.ok(forwardedRequest);
    assert.equal(forwardedRequest.headers.get("authorization"), "Basic medusa_token");

    const url = new URL(forwardedRequest.url);
    assert.equal(url.origin + url.pathname, "http://medusa:9000/admin/orders/order_1");
    assert.match(url.searchParams.get("fields") ?? "", /customer_id/);
    assert.match(url.searchParams.get("fields") ?? "", /\*payment_collections/);
    assert.match(url.searchParams.get("fields") ?? "", /\*items/);
    assert.deepEqual(result, {
      ok: true,
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        customerId: null,
        status: "pending",
        paymentStatus: "awaiting",
        fulfillmentStatus: "not_fulfilled",
        paymentMethod: "unknown",
        paymentReference: null,
        note: "Call before arrival",
        currencyCode: "etb",
        total: 1250,
        subtotal: null,
        shippingTotal: null,
        discountTotal: null,
        itemCount: 2,
        delivery: {
          choice: "delivery",
          customerName: "Abebe Kebede",
          customerPhone: "+251911111111",
          landmark: "Blue gate",
          notes: "Call before arrival",
        },
        fulfillments: [
          {
            id: "ful_1",
            deliveredAt: null,
            shippedAt: "2026-01-02T10:00:00.000Z",
            canceledAt: null,
          },
        ],
        items: [
          {
            id: "item_1",
            title: "Coffee",
            quantity: 2,
            unitPrice: 500,
            total: 1000,
            thumbnail: null,
          },
        ],
        shippingAddress: {
          firstName: "Abebe",
          lastName: "Kebede",
          phone: "+251911111111",
          address1: "Bole Road",
          address2: "Apartment 4",
          city: "Addis Ababa",
          province: "Addis Ababa",
          postalCode: "1000",
          countryCode: "et",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("does not return order details outside the resolved tenant sales channel", async () => {
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () =>
        Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_other",
          },
        }),
    });

    const result = await service.getMerchantOrder({
      orderId: "order_1",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "order_not_found",
      status: 404,
    });
  });

  it("cancels one order through the Medusa Admin API after sales-channel ownership check", async () => {
    const forwardedRequests: Request[] = [];
    let canceled = false;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.method === "POST") {
          canceled = true;
        }

        return Response.json({
          order: {
            id: "order_1",
            display_id: 1001,
            email: "customer@example.com",
            status: canceled ? "canceled" : "pending",
            payment_status: canceled ? "canceled" : "awaiting",
            fulfillment_status: "not_fulfilled",
            currency_code: "etb",
            total: 1250,
            sales_channel_id: "sc_1",
            items: [],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.mutateMerchantOrder({
      action: "cancel",
      orderId: "order_1",
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    // ownership GET → action POST → refresh GET
    assert.equal(forwardedRequests.length, 3);
    assert.equal(forwardedRequests[0]?.method, "GET");
    assert.equal(forwardedRequests[1]?.method, "POST");
    assert.equal(forwardedRequests[2]?.method, "GET");
    assert.equal(forwardedRequests[1]?.headers.get("authorization"), "Basic medusa_token");
    assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/orders/order_1/cancel");
    assert.equal(result.ok && result.order.status, "canceled");
    assert.equal(result.ok && result.order.paymentMethod, "unknown");
  });

  it("completes one order through the Medusa Admin API", async () => {
    const forwardedRequests: Request[] = [];
    let completed = false;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);
        if (request.method === "POST") {
          completed = true;
        }

        return Response.json({
          order: {
            id: "order_1",
            display_id: 1001,
            email: "customer@example.com",
            status: completed ? "completed" : "pending",
            payment_status: completed ? "captured" : "awaiting",
            fulfillment_status: completed ? "fulfilled" : "not_fulfilled",
            currency_code: "etb",
            total: 1250,
            sales_channel_id: "sc_1",
            items: [],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.mutateMerchantOrder({
      action: "complete",
      orderId: "order_1",
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    assert.equal(forwardedRequests.length, 3);
    assert.equal(forwardedRequests[1]?.method, "POST");
    assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/orders/order_1/complete");
    assert.equal(await forwardedRequests[1]?.text(), "{}");
    assert.equal(result.ok && result.order.status, "completed");
    assert.equal(result.ok && result.order.paymentStatus, "captured");
    assert.equal(result.ok && result.order.id, "order_1");
  });

  it("fulfills remaining order items through the Medusa Admin API", async () => {
    const forwardedRequests: Request[] = [];
    let fulfilled = false;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.method === "POST") {
          fulfilled = true;
        }

        if (fulfilled) {
          return Response.json({
            order: {
              id: "order_1",
              display_id: 1001,
              email: "customer@example.com",
              status: "pending",
              payment_status: "captured",
              fulfillment_status: "fulfilled",
              currency_code: "etb",
              total: 1250,
              sales_channel_id: "sc_1",
              items: [
                {
                  id: "item_1",
                  title: "Coffee",
                  quantity: 2,
                  detail: {
                    fulfilled_quantity: 2,
                  },
                },
              ],
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
          });
        }

        return Response.json({
          order: {
            id: "order_1",
            display_id: 1001,
            email: "customer@example.com",
            status: "pending",
            payment_status: "captured",
            fulfillment_status: "not_fulfilled",
            currency_code: "etb",
            total: 1250,
            sales_channel_id: "sc_1",
            items: [
              {
                id: "item_1",
                title: "Coffee",
                quantity: 3,
                detail: {
                  fulfilled_quantity: 1,
                },
              },
              {
                id: "item_2",
                title: "Tea",
                quantity: 1,
                detail: {
                  fulfilled_quantity: 1,
                },
              },
            ],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.mutateMerchantOrder({
      action: "fulfill",
      orderId: "order_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.equal(result.ok, true);
    // ownership GET → fulfill POST → refresh GET
    assert.equal(forwardedRequests.length, 3);
    assert.equal(forwardedRequests[0]?.method, "GET");
    assert.equal(forwardedRequests[1]?.method, "POST");
    assert.equal(forwardedRequests[2]?.method, "GET");
    assert.equal(forwardedRequests[1]?.url, "http://medusa:9000/admin/orders/order_1/fulfillments");
    assert.deepEqual(await forwardedRequests[1]?.json(), {
      items: [
        {
          id: "item_1",
          quantity: 2,
        },
      ],
      location_id: "sloc_1",
      metadata: {
        source: "platform",
      },
    });
    assert.equal(result.ok && result.order.fulfillmentStatus, "fulfilled");
    assert.equal(result.ok && result.order.items?.[0]?.fulfilledQuantity, 2);
  });

  it("does not fulfill orders without remaining fulfillable items", async () => {
    let calls = 0;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => {
        calls += 1;

        return Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_1",
            items: [
              {
                id: "item_1",
                quantity: 1,
                detail: {
                  fulfilled_quantity: 1,
                },
              },
            ],
          },
        });
      },
    });

    const result = await service.mutateMerchantOrder({
      action: "fulfill",
      orderId: "order_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "order_not_fulfillable",
      status: 409,
    });
    assert.equal(calls, 1);
  });

  it("marks one order fulfillment as delivered through the Medusa Admin API", async () => {
    const forwardedRequests: Request[] = [];
    let delivered = false;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async (input, init) => {
        const request = new Request(input, init);
        forwardedRequests.push(request);

        if (request.method === "POST") {
          delivered = true;
        }

        return Response.json({
          order: {
            id: "order_1",
            display_id: 1001,
            email: "customer@example.com",
            status: "pending",
            payment_status: "captured",
            fulfillment_status: delivered ? "delivered" : "fulfilled",
            currency_code: "etb",
            total: 1250,
            sales_channel_id: "sc_1",
            fulfillments: [
              {
                id: "ful_1",
                delivered_at: delivered ? "2026-01-03T00:00:00.000Z" : null,
                shipped_at: null,
                canceled_at: null,
              },
            ],
            items: [],
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: delivered ? "2026-01-03T00:00:00.000Z" : "2026-01-02T00:00:00.000Z",
          },
        });
      },
    });

    const result = await service.mutateMerchantOrder({
      action: "deliver",
      fulfillmentId: "ful_1",
      orderId: "order_1",
      salesChannelId: "sc_1",
    });

    assert.equal(result.ok, true);
    // ownership GET → deliver POST → refresh GET
    assert.equal(forwardedRequests.length, 3);
    assert.equal(forwardedRequests[0]?.method, "GET");
    assert.equal(forwardedRequests[1]?.method, "POST");
    assert.equal(forwardedRequests[2]?.method, "GET");
    assert.equal(
      forwardedRequests[1]?.url,
      "http://medusa:9000/admin/orders/order_1/fulfillments/ful_1/mark-as-delivered",
    );
    assert.equal(await forwardedRequests[1]?.text(), "{}");
    assert.equal(result.ok && result.order.fulfillmentStatus, "delivered");
    assert.equal(result.ok && result.order.fulfillments?.[0]?.deliveredAt, "2026-01-03T00:00:00.000Z");
  });

  it("does not deliver fulfillments outside the scoped order", async () => {
    let calls = 0;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => {
        calls += 1;

        return Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_1",
            fulfillments: [
              {
                id: "ful_1",
              },
            ],
          },
        });
      },
    });

    const result = await service.mutateMerchantOrder({
      action: "deliver",
      fulfillmentId: "ful_other",
      orderId: "order_1",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "order_fulfillment_not_found",
      status: 404,
    });
    assert.equal(calls, 1);
  });

  it("does not mutate orders outside the resolved tenant sales channel", async () => {
    let calls = 0;
    const service = createMedusaOrderService({
      adminApiToken: "medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => {
        calls += 1;

        return Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_other",
          },
        });
      },
    });

    const result = await service.mutateMerchantOrder({
      action: "cancel",
      orderId: "order_1",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "order_not_found",
      status: 404,
    });
    assert.equal(calls, 1);
  });

  it("fails closed when the Medusa admin token is missing", async () => {
    let calls = 0;
    const service = createMedusaOrderService({
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => {
        calls += 1;
        return Response.json({});
      },
    });

    const result = await service.listMerchantOrders({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "commerce_credentials_missing",
      status: 503,
    });
    assert.equal(calls, 0);
  });

  it("returns invalid credentials when Medusa rejects the configured admin token", async () => {
    const service = createMedusaOrderService({
      adminApiToken: "stale_medusa_token",
      medusaInternalUrl: "http://medusa:9000",
      fetcher: async () => Response.json({}, { status: 401 }),
    });

    const result = await service.listMerchantOrders({
      limit: 20,
      offset: 0,
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    });
  });
});
