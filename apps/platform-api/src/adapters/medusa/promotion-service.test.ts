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
