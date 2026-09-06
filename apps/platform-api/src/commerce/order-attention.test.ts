import assert from "node:assert/strict";
import { test } from "node:test";
import { createMedusaOrderService } from "./order-service.js";

test("attention queue scans past recent completed orders and paginates after action filtering", async () => {
  const offsets: number[] = [];
  const row = (id: string, overrides = {}) => ({
    id,
    status: "pending",
    payment_status: "captured",
    fulfillment_status: "not_fulfilled",
    sales_channel_id: "sc_shop",
    currency_code: "etb",
    total: 250,
    items: [
      {
        id: `item_${id}`,
        title: "Cotton shirt",
        thumbnail: "https://example.com/shirt.jpg",
        quantity: 1,
      },
    ],
    ...overrides,
  });
  const service = createMedusaOrderService({
    adminApiToken: "test",
    medusaInternalUrl: "http://medusa:9000",
    fetcher: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("sales_channel_id[]"), "sc_shop");
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      const orders =
        offset === 0
          ? Array.from({ length: 50 }, (_, i) => row(`order_done_${i}`, { status: "completed" }))
          : [
              row("order_cancelled", { status: "canceled" }),
              row("order_cod_ready", {
                payment_status: "awaiting",
                fulfillment_status: "fulfilled",
                metadata: { payment_method: "cod" },
              }),
              row("order_old_unfulfilled"),
              row("order_payment", {
                payment_status: "awaiting",
                fulfillment_status: "delivered",
                metadata: { payment_method: "cod" },
              }),
              row("order_foreign", { sales_channel_id: "sc_other" }),
            ];
      return Response.json({ orders, count: 55, limit: 50, offset });
    },
  });
  const result = await service.listMerchantOrders({
    salesChannelId: "sc_shop",
    attentionOnly: true,
    limit: 12,
    offset: 0,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(offsets, [0, 50]);
  assert.deepEqual(
    result.orders.map((order) => order.id),
    ["order_old_unfulfilled", "order_payment"],
  );
  assert.equal(result.orders[0]?.items?.[0]?.thumbnail, "https://example.com/shirt.jpg");
});
