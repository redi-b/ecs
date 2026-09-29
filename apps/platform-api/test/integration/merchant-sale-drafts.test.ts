import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantSaleDraft, MerchantSaleDraftContent } from "@ecs/contracts";

import {
  createInMemoryMerchantSaleDraftStore,
  createMerchantSaleDraftService,
  createMerchantSaleDraftValidator,
} from "../../src/modules/commerce/merchant-sale-drafts.js";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant sale drafts", () => {
  it("saves and resumes a tenant-owned assisted-sale draft without creating an order", async () => {
    const drafts = new Map<string, MerchantSaleDraft>();
    let orderCreates = 0;
    const app = appWithResolution({ ok: true, context: resolvedTenantContext }, {
      authorizeDashboardForTenant: async () => ({
        ok: true,
        actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
      }),
      createMerchantManualOrder: async () => {
        orderCreates += 1;
        return { ok: true, order: { id: "order_1", displayId: 1001, status: "pending" } };
      },
      getMerchantSaleDraft: async ({ draftId }: { draftId: string }) => {
        const draft = drafts.get(draftId);
        return draft
          ? { ok: true as const, draft }
          : { ok: false as const, error: "sale_draft_not_found", status: 404 as const };
      },
      saveMerchantSaleDraft: async (input: {
        content: MerchantSaleDraftContent;
        draftId?: string | undefined;
        ownerUserId: string;
      }) => {
        const draft = {
          ...input.content,
          id: input.draftId ?? "draft_1",
          ownerUserId: input.ownerUserId,
          conflicts: [],
          createdAt: "2026-09-29T10:00:00.000Z",
          revision: 1,
          updatedAt: "2026-09-29T10:00:00.000Z",
        };
        drafts.set(draft.id, draft);
        return { ok: true as const, draft };
      },
      getSession: async () => ({
        user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
      }),
    });
    const payload = {
      currentStep: 1,
      customer: { id: "customer_1", phone: "+251911234567" },
      items: [{ productId: "prod_1", quantity: 2, unitPrice: 125, variantId: "variant_1" }],
      note: "Deliver near Meskel Square",
    };

    const saved = await app.request("/platform/merchant/sale-drafts", {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
        "Idempotency-Key": "draft-save-1",
      },
      method: "POST",
    });
    const resumed = await app.request("/platform/merchant/sale-drafts/draft_1", {
      headers: { Host: "abebe.lvh.me" },
    });

    assert.equal(saved.status, 201);
    assert.equal(resumed.status, 200);
    assert.equal(orderCreates, 0);
    assert.deepEqual((await resumed.json()).draft.items, payload.items);
  });

  it("fails closed across tenants and rejects stale revisions", async () => {
    const service = createMerchantSaleDraftService({
      store: createInMemoryMerchantSaleDraftStore(),
      validate: async () => ({ ok: true, conflicts: [] }),
    });
    const content = {
      currencyCode: "etb" as const,
      currentStep: 1,
      customer: { phone: "+251911234567" },
      items: [{ productId: "prod_1", quantity: 1, unitPrice: 125, variantId: "variant_1" }],
    };
    const created = await service.save({
      content,
      ownerUserId: "user_1",
      salesChannelId: "sc_1",
      tenantId: "tenant_1",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    assert.equal(await service.get({ draftId: created.draft.id, tenantId: "tenant_2" }), null);
    const stale = await service.save({
      content,
      draftId: created.draft.id,
      expectedRevision: created.draft.revision + 1,
      ownerUserId: "user_1",
      salesChannelId: "sc_1",
      tenantId: "tenant_1",
    });
    assert.deepEqual(stale, {
      error: "sale_draft_revision_conflict",
      ok: false,
      status: 409,
    });
  });

  it("reports authoritative price and stock changes without rewriting the draft", async () => {
    const validate = createMerchantSaleDraftValidator({
      getProduct: async () => ({
        ok: true,
        product: {
          createdAt: null,
          handle: "coffee",
          id: "prod_1",
          status: "published",
          thumbnail: null,
          title: "Coffee",
          updatedAt: null,
          variants: [
            {
              id: "variant_1",
              prices: [{ amount: 150, currencyCode: "etb" }],
              sku: "COFFEE-1",
              stock: {
                availableQuantity: 1,
                incomingQuantity: 0,
                locationId: "loc_1",
                reservedQuantity: 0,
                stockedQuantity: 1,
              },
              title: "Default",
            },
          ],
        },
      }),
    });
    const content = {
      currencyCode: "etb" as const,
      currentStep: 1,
      customer: {},
      items: [{ productId: "prod_1", quantity: 2, unitPrice: 125, variantId: "variant_1" }],
    };
    const result = await validate({ content, salesChannelId: "sc_1" });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.conflicts.map((conflict) => conflict.code),
      ["price_changed", "insufficient_stock"],
    );
    assert.equal(content.items[0]?.unitPrice, 125);
    assert.equal(content.items[0]?.quantity, 2);
  });
});
