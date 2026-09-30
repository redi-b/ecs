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
      if (request.method === "GET")
        return Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_1",
            fulfillment_status: "delivered",
            items: [{ id: "item_1", quantity: 2 }],
          },
        });
      if (request.url.endsWith("/admin/returns"))
        return Response.json({ return: { id: "return_1" } });
      if (request.url.endsWith("/request-items"))
        return Response.json({ return: { id: "return_1" } });
      return Response.json({
        return: {
          id: "return_1",
          status: "requested",
          location_id: "loc_1",
          items: [
            {
              id: "retitem_1",
              item_id: "item_1",
              quantity: 1,
              received_quantity: 0,
              damaged_quantity: 0,
            },
          ],
          requested_at: "2026-09-29T10:00:00.000Z",
          created_at: "2026-09-29T09:59:00.000Z",
        },
      });
    },
  });

  const result = await service.createMerchantReturn({
    orderId: "order_1",
    salesChannelId: "sc_1",
    locationId: "loc_1",
    note: "Shop drop-off",
    items: [{ lineItemId: "item_1", quantity: 1, note: "Wrong size" }],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
    [
      "GET /admin/orders/order_1",
      "POST /admin/returns",
      "POST /admin/returns/return_1/request-items",
      "POST /admin/returns/return_1/request",
    ],
  );
  assert.deepEqual(await requests[1]?.json(), {
    order_id: "order_1",
    location_id: "loc_1",
    internal_note: "Shop drop-off",
    no_notification: true,
  });
  assert.deepEqual(result.ok && result.orderReturn.items[0], {
    id: "retitem_1",
    lineItemId: "item_1",
    quantity: 1,
    receivedQuantity: 0,
    damagedQuantity: 0,
    reasonId: null,
    note: null,
  });
});

test("rejects a foreign or undelivered order before creating a return", async () => {
  let requestCount = 0;
  const service = createMedusaOrderService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa:9000",
    fetcher: async () => {
      requestCount += 1;
      return Response.json({
        order: { id: "order_1", sales_channel_id: "sc_other", fulfillment_status: "delivered" },
      });
    },
  });
  assert.deepEqual(
    await service.createMerchantReturn({
      orderId: "order_1",
      salesChannelId: "sc_1",
      items: [{ lineItemId: "item_1", quantity: 1 }],
    }),
    { ok: false, error: "order_not_found", status: 404 },
  );
  assert.equal(requestCount, 1);
});

test("rejects quantities already committed to an active return", async () => {
  let requestCount = 0;
  const service = createMedusaOrderService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa:9000",
    fetcher: async () => {
      requestCount += 1;
      return Response.json({
        order: {
          id: "order_1",
          sales_channel_id: "sc_1",
          fulfillment_status: "delivered",
          items: [{ id: "item_1", quantity: 2 }],
          returns: [
            {
              id: "return_existing",
              status: "requested",
              items: [{ id: "retitem_existing", item_id: "item_1", quantity: 1 }],
            },
          ],
        },
      });
    },
  });
  assert.deepEqual(
    await service.createMerchantReturn({
      orderId: "order_1",
      salesChannelId: "sc_1",
      items: [{ lineItemId: "item_1", quantity: 2 }],
    }),
    { ok: false, error: "order_return_invalid", status: 409 },
  );
  assert.equal(requestCount, 1);
});

test("receives sellable and damaged return quantities through Medusa exactly once", async () => {
  const requests: Request[] = [];
  const service = createMedusaOrderService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa:9000",
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.method === "GET") {
        return Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_1",
            fulfillment_status: "delivered",
            items: [
              {
                id: "item_1",
                product_id: "prod_1",
                variant_id: "variant_1",
                quantity: 2,
                variant: {
                  inventory_items: [{ inventory_item_id: "iitem_1" }],
                },
              },
            ],
            returns: [
              {
                id: "return_1",
                status: "requested",
                location_id: "loc_1",
                items: [
                  {
                    id: "retitem_1",
                    item_id: "item_1",
                    quantity: 2,
                    received_quantity: 0,
                    damaged_quantity: 0,
                  },
                ],
              },
            ],
          },
        });
      }
      if (request.url.endsWith("/receive/confirm")) {
        return Response.json({
          return: {
            id: "return_1",
            status: "received",
            location_id: "loc_1",
            received_at: "2026-09-29T12:00:00.000Z",
            items: [
              {
                id: "retitem_1",
                item_id: "item_1",
                quantity: 2,
                received_quantity: 1,
                damaged_quantity: 1,
              },
            ],
          },
        });
      }
      return Response.json({ return: { id: "return_1" } });
    },
  });

  const result = await service.receiveMerchantReturn({
    orderId: "order_1",
    returnId: "return_1",
    salesChannelId: "sc_1",
    items: [{ lineItemId: "item_1", sellableQuantity: 1, damagedQuantity: 1 }],
  });

  assert.deepEqual(
    requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
    [
      "GET /admin/orders/order_1",
      "POST /admin/returns/return_1/receive",
      "POST /admin/returns/return_1/receive-items",
      "POST /admin/returns/return_1/dismiss-items",
      "POST /admin/returns/return_1/receive/confirm",
    ],
  );
  assert.deepEqual(await requests[2]?.json(), {
    items: [{ id: "item_1", quantity: 1 }],
  });
  assert.deepEqual(await requests[3]?.json(), {
    items: [{ id: "item_1", quantity: 1 }],
  });
  assert.deepEqual(result, {
    ok: true,
    orderReturn: {
      id: "return_1",
      status: "received",
      locationId: "loc_1",
      items: [
        {
          id: "retitem_1",
          lineItemId: "item_1",
          quantity: 2,
          receivedQuantity: 1,
          damagedQuantity: 1,
          reasonId: null,
          note: null,
        },
      ],
      requestedAt: null,
      receivedAt: "2026-09-29T12:00:00.000Z",
      canceledAt: null,
      createdAt: null,
    },
    movements: [
      {
        damagedQuantity: 1,
        inventoryItemId: "iitem_1",
        lineItemId: "item_1",
        productId: "prod_1",
        sellableQuantity: 1,
        variantId: "variant_1",
      },
    ],
  });
});

test("repairs a stranded receival before retrying the same return", async () => {
  const requests: Request[] = [];
  let beginAttempts = 0;
  const service = createMedusaOrderService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa:9000",
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.method === "GET") {
        return Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_1",
            fulfillment_status: "delivered",
            items: [{ id: "item_1", quantity: 1 }],
            returns: [
              {
                id: "return_1",
                status: "requested",
                items: [
                  {
                    id: "retitem_1",
                    item_id: "item_1",
                    quantity: 1,
                    received_quantity: 0,
                    damaged_quantity: 0,
                  },
                ],
              },
            ],
          },
        });
      }
      if (request.url.endsWith("/receive") && request.method === "POST") {
        beginAttempts += 1;
        if (beginAttempts === 1) {
          return Response.json(
            { message: "Order (order_1) already has an existing active order change" },
            { status: 400 },
          );
        }
      }
      if (request.url.endsWith("/receive/confirm")) {
        return Response.json({
          return: {
            id: "return_1",
            status: "received",
            received_at: "2026-09-30T11:37:03.000Z",
            items: [
              {
                id: "retitem_1",
                item_id: "item_1",
                quantity: 1,
                received_quantity: 1,
                damaged_quantity: 0,
              },
            ],
          },
        });
      }
      return Response.json({ return: { id: "return_1" } });
    },
  });

  const result = await service.receiveMerchantReturn({
    orderId: "order_1",
    returnId: "return_1",
    salesChannelId: "sc_1",
    items: [{ lineItemId: "item_1", sellableQuantity: 1, damagedQuantity: 0 }],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
    [
      "GET /admin/orders/order_1",
      "POST /admin/returns/return_1/receive",
      "DELETE /admin/returns/return_1/receive",
      "POST /admin/returns/return_1/receive",
      "POST /admin/returns/return_1/receive-items",
      "POST /admin/returns/return_1/receive/confirm",
    ],
  );
});

test("cancels an opened receival when an item update fails", async () => {
  const requests: Request[] = [];
  const service = createMedusaOrderService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa:9000",
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.method === "GET") {
        return Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_1",
            fulfillment_status: "delivered",
            items: [{ id: "item_1", quantity: 1 }],
            returns: [
              {
                id: "return_1",
                status: "requested",
                items: [
                  {
                    id: "retitem_1",
                    item_id: "item_1",
                    quantity: 1,
                    received_quantity: 0,
                    damaged_quantity: 0,
                  },
                ],
              },
            ],
          },
        });
      }
      if (request.url.endsWith("/receive-items")) {
        return Response.json({ message: "Cannot receive item" }, { status: 400 });
      }
      return Response.json({ return: { id: "return_1" } });
    },
  });

  const result = await service.receiveMerchantReturn({
    orderId: "order_1",
    returnId: "return_1",
    salesChannelId: "sc_1",
    items: [{ lineItemId: "item_1", sellableQuantity: 1, damagedQuantity: 0 }],
  });

  assert.deepEqual(result, { ok: false, error: "order_return_invalid", status: 400 });
  assert.deepEqual(
    requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
    [
      "GET /admin/orders/order_1",
      "POST /admin/returns/return_1/receive",
      "POST /admin/returns/return_1/receive-items",
      "DELETE /admin/returns/return_1/receive",
    ],
  );
});

test("receives a return for a line without managed inventory instead of failing the sale correction", async () => {
  const requests: Request[] = [];
  const service = createMedusaOrderService({
    adminApiToken: "token",
    medusaInternalUrl: "http://medusa:9000",
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (request.method === "GET") {
        return Response.json({
          order: {
            id: "order_1",
            sales_channel_id: "sc_1",
            fulfillment_status: "delivered",
            items: [{ id: "item_1", product_id: "prod_1", variant_id: "variant_1", quantity: 1 }],
            returns: [
              {
                id: "return_1",
                status: "requested",
                items: [
                  {
                    id: "retitem_1",
                    item_id: "item_1",
                    quantity: 1,
                    received_quantity: 0,
                    damaged_quantity: 0,
                  },
                ],
              },
            ],
          },
        });
      }
      if (request.url.endsWith("/receive/confirm")) {
        return Response.json({
          return: {
            id: "return_1",
            status: "received",
            received_at: "2026-09-30T07:15:56.000Z",
            items: [
              {
                id: "retitem_1",
                item_id: "item_1",
                quantity: 1,
                received_quantity: 1,
                damaged_quantity: 0,
              },
            ],
          },
        });
      }
      return Response.json({ return: { id: "return_1" } });
    },
  });

  const result = await service.receiveMerchantReturn({
    orderId: "order_1",
    returnId: "return_1",
    salesChannelId: "sc_1",
    items: [{ lineItemId: "item_1", sellableQuantity: 1, damagedQuantity: 0 }],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.movements, []);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
    [
      "GET /admin/orders/order_1",
      "POST /admin/returns/return_1/receive",
      "POST /admin/returns/return_1/receive-items",
      "POST /admin/returns/return_1/receive/confirm",
    ],
  );
});
