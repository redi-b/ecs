import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant quotations", () => {
  it("issues an immutable ETB quotation from a saved draft without creating an order", async () => {
    let orderCreates = 0;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        createMerchantManualOrder: async () => {
          orderCreates += 1;
          return { ok: true, order: { id: "order_1", displayId: 1001, status: "pending" } };
        },
        getMerchantSaleDraft: async () => ({
          ok: true,
          draft: {
            conflicts: [],
            createdAt: "2026-09-29T08:00:00.000Z",
            currencyCode: "etb",
            currentStep: 2,
            customer: { firstName: "Almaz", phone: "+251911234567" },
            id: "draft_1",
            items: [{ productId: "prod_1", quantity: 2, unitPrice: 125, variantId: "variant_1" }],
            ownerUserId: "user_1",
            revision: 3,
            updatedAt: "2026-09-29T09:00:00.000Z",
          },
        }),
        issueMerchantQuotation: async (input) => ({
          ok: true,
          quotation: {
            convertedOrderId: null,
            createdAt: "2026-09-29T10:00:00.000Z",
            currentRevision: 1,
            id: "quote_1",
            number: "Q-000001",
            snapshot: input.snapshot,
            status: "issued",
            updatedAt: "2026-09-29T10:00:00.000Z",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
      },
    );

    const response = await app.request("/platform/merchant/quotations", {
      body: JSON.stringify({ draftId: "draft_1", language: "am" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
        "Idempotency-Key": "quote-issue-1",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.quotation.number, "Q-000001");
    assert.equal(body.quotation.snapshot.currencyCode, "etb");
    assert.equal(body.quotation.snapshot.language, "am");
    assert.equal(orderCreates, 0);
  });

  it("converts a quote to one ordinary order and returns that order on retry", async () => {
    let convertedOrderId: string | null = null;
    let orderCreates = 0;
    const snapshot = {
      currencyCode: "etb" as const,
      currentStep: 2,
      customer: { phone: "+251911234567" },
      draftId: "draft_1",
      draftRevision: 3,
      expiresAt: "2026-10-13T10:00:00.000Z",
      issuedAt: "2026-09-29T10:00:00.000Z",
      items: [{ productId: "prod_1", quantity: 1, unitPrice: 125, variantId: "variant_1" }],
      language: "en" as const,
      sellerName: "Abebe Market",
      templateVersion: 1 as const,
    };
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        createMerchantManualOrder: async () => {
          orderCreates += 1;
          return { ok: true, order: { id: "order_1", displayId: 1001, status: "pending" } };
        },
        getMerchantQuotation: async () => ({
          ok: true,
          quotation: {
            convertedOrderId,
            createdAt: snapshot.issuedAt,
            currentRevision: 1,
            id: "quote_1",
            number: "Q-000001",
            snapshot,
            status: convertedOrderId ? "converted" : "issued",
            updatedAt: snapshot.issuedAt,
          },
          revisions: [],
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        markMerchantQuotationConverted: async ({ orderId }) => {
          convertedOrderId = orderId;
          return true;
        },
        validateMerchantSaleDraft: async () => ({ ok: true, conflicts: [] }),
      },
    );
    const request = () =>
      app.request("/platform/merchant/quotations/quote_1/convert", {
        body: JSON.stringify({ confirmChanges: false }),
        headers: {
          "content-type": "application/json",
          Host: "abebe.lvh.me",
          "Idempotency-Key": "convert-1",
        },
        method: "POST",
      });
    const first = await request();
    const retry = await request();
    assert.equal(first.status, 200);
    assert.equal(retry.status, 200);
    assert.equal(orderCreates, 1);
    assert.equal((await retry.json()).orderId, "order_1");
  });
});
