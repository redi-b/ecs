import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant inventory movements", () => {
  it("records the actual Medusa stock delta with tenant, actor, and reason", async () => {
    const movements: unknown[] = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        appendMerchantInventoryMovement: async (input) => {
          movements.push(input);
          return {
            movement: {
              ...input,
              createdAt: "2026-09-29T10:00:00.000Z",
              id: "movement_1",
            },
          };
        },
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getMerchantProductVariantStock: async () => ({
          ok: true,
          stock: {
            availableQuantity: 4,
            incomingQuantity: 0,
            inventoryItemId: "iitem_1",
            locationId: "sloc_1",
            productId: "prod_1",
            reservedQuantity: 1,
            stockedQuantity: 5,
            variantId: "variant_1",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        updateMerchantProductVariantStock: async () => ({
          ok: true,
          stock: {
            availableQuantity: 7,
            incomingQuantity: 0,
            inventoryItemId: "iitem_1",
            locationId: "sloc_1",
            productId: "prod_1",
            reservedQuantity: 1,
            stockedQuantity: 8,
            variantId: "variant_1",
          },
        }),
      },
    );

    const response = await app.request(
      "/platform/merchant/products/prod_1/variants/variant_1/stock",
      {
        body: JSON.stringify({
          note: "New coffee delivery",
          reason: "stock_received",
          stockedQuantity: 8,
        }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
          "Idempotency-Key": "stock-adjustment-1",
        },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.equal(movements.length, 1);
    assert.deepEqual(movements[0], {
      actorUserId: "user_1",
      delta: 3,
      inventoryItemId: "iitem_1",
      locationId: "sloc_1",
      note: "New coffee delivery",
      observedAfter: 8,
      observedBefore: 5,
      productId: "prod_1",
      reason: "stock_received",
      sourceId: "stock-adjustment-1",
      sourceType: "manual_adjustment",
      tenantId: resolvedTenantContext.tenantId,
      variantId: "variant_1",
    });
  });

  it("scopes product history to the resolved tenant and configured location", async () => {
    const reads: unknown[] = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        listMerchantInventoryMovements: async (input) => {
          reads.push(input);
          return { count: 0, limit: input.limit, movements: [], offset: input.offset };
        },
      },
    );

    const response = await app.request(
      "/platform/merchant/products/prod_1/inventory-movements?variantId=variant_1&limit=10",
      { headers: { Host: "abebe.lvh.me" } },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(reads, [
      {
        limit: 10,
        locationId: "sloc_1",
        offset: 0,
        productId: "prod_1",
        tenantId: resolvedTenantContext.tenantId,
        variantId: "variant_1",
      },
    ]);
  });

  it("projects only events with a stable occurrence and proven delta", async () => {
    const movements: unknown[] = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        appendMerchantInventoryMovement: async (input) => {
          movements.push(input);
          return {
            movement: {
              ...input,
              createdAt: "2026-09-29T10:05:00.000Z",
              id: "movement_event_1",
            },
          };
        },
        internalApiToken: "internal-test-token",
        resolveTenantIdByMedusaSalesChannelId: async () => resolvedTenantContext.tenantId,
      },
    );
    const request = (payload: Record<string, unknown>) =>
      app.request("/platform/internal/inventory/events", {
        body: JSON.stringify({
          eventName: "reservation-item.updated",
          inventoryItemId: "iitem_1",
          locationId: "sloc_1",
          medusaSalesChannelId: "sc_1",
          reason: "reservation",
          subjectId: "reservation_1",
          subjectType: "reservation_item",
          ...payload,
        }),
        headers: {
          "content-type": "application/json",
          "x-platform-internal-token": "internal-test-token",
        },
        method: "POST",
      });

    const unproven = await request({ delta: -2, observedAfter: 8, observedBefore: 9 });
    const missingOccurrence = await request({ delta: -2, observedAfter: 8, observedBefore: 10 });
    const accepted = await request({
      delta: -2,
      metadata: { created_at: "2026-09-29T10:05:00.000Z", eventGroupId: "order_1" },
      observedAfter: 8,
      observedBefore: 10,
    });

    assert.equal(unproven.status, 422);
    assert.equal(missingOccurrence.status, 422);
    assert.equal(accepted.status, 201);
    assert.equal(movements.length, 1);
    assert.match(
      (movements[0] as { sourceId: string }).sourceId,
      /^v1:medusa:reservation-item\.updated:reservation_item:reservation_1:/,
    );
  });
});
