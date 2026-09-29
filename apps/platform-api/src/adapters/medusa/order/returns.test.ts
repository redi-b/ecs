import assert from "node:assert/strict";
import { test } from "node:test";
import { createMedusaOrderService } from "./service.js";

test("creates a requested return through Medusa after tenant and quantity validation", async () => {
  const requests: Request[] = [];
  const service = createMedusaOrderService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa:9000",
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.method === "GET") return Response.json({ order: {
        id: "order_1", sales_channel_id: "sc_1", fulfillment_status: "delivered",
        items: [{ id: "item_1", quantity: 2 }],
      }});
      if (request.url.endsWith("/admin/returns")) return Response.json({ return: { id: "return_1" } });
      if (request.url.endsWith("/request-items")) return Response.json({ return: { id: "return_1" } });
      return Response.json({ return: {
        id: "return_1", status: "requested", location_id: "loc_1",
        items: [{ id: "retitem_1", item_id: "item_1", quantity: 1, received_quantity: 0, damaged_quantity: 0 }],
        requested_at: "2026-09-29T10:00:00.000Z", created_at: "2026-09-29T09:59:00.000Z",
      }});
    },
  });

  const result = await service.createMerchantReturn({
    orderId: "order_1", salesChannelId: "sc_1", locationId: "loc_1", note: "Shop drop-off",
    items: [{ lineItemId: "item_1", quantity: 1, note: "Wrong size" }],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`), [
    "GET /admin/orders/order_1", "POST /admin/returns",
    "POST /admin/returns/return_1/request-items", "POST /admin/returns/return_1/request",
  ]);
  assert.deepEqual(await requests[1]?.json(), {
    order_id: "order_1", location_id: "loc_1", internal_note: "Shop drop-off", no_notification: true,
  });
  assert.deepEqual(result.ok && result.orderReturn.items[0], {
    id: "retitem_1", lineItemId: "item_1", quantity: 1, receivedQuantity: 0,
    damagedQuantity: 0, reasonId: null, note: null,
  });
});

test("rejects a foreign or undelivered order before creating a return", async () => {
  let requestCount = 0;
  const service = createMedusaOrderService({
    adminApiToken: "token", medusaInternalUrl: "http://medusa:9000",
    fetcher: async () => {
      requestCount += 1;
      return Response.json({ order: { id: "order_1", sales_channel_id: "sc_other", fulfillment_status: "delivered" } });
    },
  });
  assert.deepEqual(await service.createMerchantReturn({
    orderId: "order_1", salesChannelId: "sc_1", items: [{ lineItemId: "item_1", quantity: 1 }],
  }), { ok: false, error: "order_not_found", status: 404 });
  assert.equal(requestCount, 1);
});
