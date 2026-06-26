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
              status: "pending",
              payment_status: "awaiting",
              fulfillment_status: "not_fulfilled",
              currency_code: "etb",
              total: 1250,
              sales_channel_id: "sc_1",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
            {
              id: "order_other",
              sales_channel_id: "sc_other",
            },
          ],
          count: 2,
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
    assert.equal(forwardedRequest.headers.get("x-medusa-access-token"), "medusa_token");

    const url = new URL(forwardedRequest.url);
    assert.equal(url.origin + url.pathname, "http://medusa:9000/admin/orders");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.get("offset"), "5");
    assert.equal(url.searchParams.get("order"), "-created_at");
    assert.equal(
      url.searchParams.get("fields"),
      "id,display_id,email,status,payment_status,fulfillment_status,currency_code,total,sales_channel_id,created_at,updated_at",
    );
    assert.deepEqual(result, {
      ok: true,
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
      limit: 10,
      offset: 5,
    });
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
});
