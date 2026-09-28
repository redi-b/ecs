import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMedusaPromotionService } from "./promotion-service.js";

function rawPromotion(id: string, tenantId: string, targetType: "items" | "order" = "order") {
  return {
    application_method: { target_type: targetType, type: "percentage", value: 10 },
    code: id.toUpperCase(),
    created_at: "2026-01-01T00:00:00.000Z",
    id,
    is_automatic: false,
    metadata: { platform_tenant_id: tenantId },
    status: "active",
    type: "standard",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("Medusa promotion listing", () => {
  it("forwards all filters and pagination to the tenant-scoped Medusa query", async () => {
    const offsets: string[] = [];
    const owned = rawPromotion("promo_owned", "tenant_1", "items");
    const service = createMedusaPromotionService({
      adminApiToken: "token",
      medusaInternalUrl: "http://medusa",
      fetcher: async (input) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/admin/platform-promotions");
        assert.equal(
          url.searchParams.has("order"),
          false,
          "sort is configured inside the module query",
        );
        for (const [key, value] of Object.entries({
          tenant_id: "tenant_1",
          offer: "products",
          apply: "code",
          status: "active",
          schedule: "current",
          q: "OWNED",
          limit: "20",
        })) {
          assert.equal(url.searchParams.get(key), value);
        }
        const offset = url.searchParams.get("offset") ?? "0";
        offsets.push(offset);
        return Response.json({
          count: 121,
          promotions: [owned],
        });
      },
    });

    const result = await service.listPromotions({
      apply: "code",
      limit: 20,
      offer: "products",
      offset: 120,
      query: "OWNED",
      schedule: "current",
      status: "active",
      tenantId: "tenant_1",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(offsets, ["120"]);
    assert.equal(result.count, 121);
    assert.deepEqual(
      result.promotions.map((promotion) => promotion.id),
      ["promo_owned"],
    );
  });

  for (const payload of [
    { promotions: [rawPromotion("foreign", "tenant_other")], count: 1 },
    { promotions: [rawPromotion("same", "tenant_1"), rawPromotion("same", "tenant_1")], count: 2 },
    { promotions: [], count: -1 },
    { promotions: [], count: "10" },
  ]) {
    it("rejects malformed or foreign-tenant results instead of returning partial data", async () => {
      const service = createMedusaPromotionService({
        medusaInternalUrl: "http://medusa",
        fetcher: async () => Response.json(payload),
      });
      assert.deepEqual(
        await service.listPromotions({ tenantId: "tenant_1", limit: 20, offset: 0 }),
        { ok: false, error: "commerce_backend_error", status: 502 },
      );
    });
  }

  it("preserves an upstream processing error instead of reporting an outage", async () => {
    const service = createMedusaPromotionService({
      medusaInternalUrl: "http://medusa",
      fetcher: async () =>
        Response.json(
          { message: "Trying to order by not existing property Promotion.created_at,id" },
          { status: 500 },
        ),
    });
    assert.deepEqual(await service.listPromotions({ tenantId: "tenant_1", limit: 20, offset: 0 }), {
      ok: false,
      error: "commerce_backend_error",
      status: 502,
    });
  });
});

describe("Medusa promotion writes", () => {
  it("preserves standard product targeting when updating", async () => {
    let updateBody: Record<string, unknown> | undefined;
    const service = createMedusaPromotionService({
      medusaInternalUrl: "http://medusa",
      fetcher: async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === "/admin/promotions/promo_owned" && init?.method === "POST") {
          updateBody = JSON.parse(String(init.body));
          return Response.json({ promotion: rawPromotion("promo_owned", "tenant_1", "items") });
        }
        return Response.json({
          promotion: {
            ...rawPromotion("promo_owned", "tenant_1", "items"),
            application_method: {
              allocation: "each",
              max_quantity: 2,
              target_rules: [
                { attribute: "items.product.id", operator: "in", values: ["prod_1"] },
              ],
              target_type: "items",
              type: "percentage",
              value: 15,
            },
          },
        });
      },
    });

    const result = await service.updatePromotion({
      allocation: "each",
      code: "fall15",
      isAutomatic: false,
      isTaxInclusive: false,
      maxQuantity: 2,
      method: "percentage",
      productIds: ["prod_1", " prod_2 "],
      promotionId: "promo_owned",
      promotionType: "standard",
      status: "active",
      targetType: "items",
      tenantId: "tenant_1",
      value: 15,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(updateBody?.application_method, {
      allocation: "each",
      max_quantity: 2,
      target_rules: [
        {
          attribute: "items.product.id",
          operator: "in",
          values: ["prod_1", "prod_2"],
        },
      ],
      target_type: "items",
      type: "percentage",
      value: 15,
    });
  });

  it("preserves buy and target rules when updating a buy-get promotion", async () => {
    let updateBody: Record<string, unknown> | undefined;
    const service = createMedusaPromotionService({
      medusaInternalUrl: "http://medusa",
      fetcher: async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === "/admin/promotions/promo_buyget" && init?.method === "POST") {
          updateBody = JSON.parse(String(init.body));
        }
        return Response.json({
          promotion: {
            ...rawPromotion("promo_buyget", "tenant_1", "items"),
            type: "buyget",
          },
        });
      },
    });

    const result = await service.updatePromotion({
      allocation: "each",
      applyToQuantity: 1,
      buyMinQuantity: 2,
      buyProductIds: ["prod_buy"],
      code: "buy2get1",
      maxQuantity: 1,
      method: "percentage",
      productIds: ["prod_get"],
      promotionId: "promo_buyget",
      promotionType: "buyget",
      status: "active",
      targetType: "items",
      tenantId: "tenant_1",
      value: 100,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(updateBody?.application_method, {
      allocation: "each",
      apply_to_quantity: 1,
      buy_rules: [
        { attribute: "items.product.id", operator: "in", values: ["prod_buy"] },
      ],
      buy_rules_min_quantity: 2,
      max_quantity: 1,
      target_rules: [
        { attribute: "items.product.id", operator: "in", values: ["prod_get"] },
      ],
      target_type: "items",
      type: "percentage",
      value: 100,
    });
  });
});
