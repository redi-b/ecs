import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMedusaManualOrderService } from "./manual-order-service.js";

describe("createMedusaManualOrderService", () => {
  it("creates a draft order, attaches shipping, and converts to order", async () => {
    const calls: Array<{ body?: string | undefined; method?: string | undefined; url: string }> =
      [];

    const service = createMedusaManualOrderService({
      adminApiToken: "token",
      fetcher: async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? init.body : undefined;
        calls.push({ body, method, url });

        if (url.endsWith("/admin/draft-orders") && method === "POST") {
          return new Response(JSON.stringify({ draft_order: { id: "draft_1" } }), {
            status: 200,
          });
        }

        if (url.includes("/shipping-methods") && method === "POST") {
          return new Response(JSON.stringify({ draft_order_preview: { id: "draft_1" } }), {
            status: 200,
          });
        }

        if (url.includes("/convert-to-order") && method === "POST") {
          return new Response(
            JSON.stringify({
              order: { display_id: 42, id: "order_1", status: "pending" },
            }),
            { status: 200 },
          );
        }

        return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
      },
      medusaInternalUrl: "http://medusa.test",
    });

    const result = await service.createManualOrder({
      customerEmail: "buyer@example.com",
      items: [{ quantity: 2, variantId: "variant_1" }],
      regionId: "reg_1",
      salesChannelId: "sc_1",
      shippingAddress: {
        address1: "Bole Road",
        city: "Addis Ababa",
        countryCode: "et",
        firstName: "Abebe",
      },
      shippingOptionId: "so_1",
      tenantId: "tenant_1",
      userId: "user_1",
    });

    assert.deepEqual(result, {
      ok: true,
      order: {
        displayId: 42,
        id: "order_1",
        status: "pending",
      },
    });

    assert.equal(calls.length, 3);
    assert.match(calls[0]?.url ?? "", /\/admin\/draft-orders$/);
    assert.equal(calls[0]?.method, "POST");
    assert.match(calls[0]?.body ?? "", /variant_1/);
    assert.match(calls[0]?.body ?? "", /buyer@example.com/);
    assert.match(calls[1]?.url ?? "", /shipping-methods/);
    assert.match(calls[1]?.body ?? "", /shipping_option_id/);
    assert.match(calls[2]?.url ?? "", /convert-to-order/);
  });

  it("returns invalid_manual_order when draft creation is rejected", async () => {
    const service = createMedusaManualOrderService({
      adminApiToken: "token",
      fetcher: async () => new Response(JSON.stringify({ message: "bad" }), { status: 400 }),
      medusaInternalUrl: "http://medusa.test",
    });

    const result = await service.createManualOrder({
      customerEmail: "buyer@example.com",
      items: [{ quantity: 1, variantId: "variant_1" }],
      regionId: "reg_1",
      salesChannelId: "sc_1",
      tenantId: "tenant_1",
      userId: "user_1",
    });

    assert.deepEqual(result, {
      error: "invalid_manual_order",
      ok: false,
      status: 400,
    });
  });
});
