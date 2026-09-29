import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("merchant operational sales documents", () => {
  it("issues an immutable non-tax order summary from authoritative order state", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getMerchantOrder: async () => ({
          ok: true,
          order: {
            createdAt: "2026-09-29T08:00:00.000Z",
            currencyCode: "etb",
            customDisplayId: "ORD-1001",
            displayId: 1001,
            email: "almaz@example.com",
            fulfillmentStatus: "not_fulfilled",
            id: "order_1",
            items: [
              {
                fulfilledQuantity: 0,
                id: "item_1",
                productId: "prod_1",
                quantity: 2,
                thumbnail: null,
                title: "Coffee",
                total: 250,
                unitPrice: 125,
                variantId: "variant_1",
              },
            ],
            paymentStatus: "not_paid",
            refundedTotal: 0,
            shippingAddress: {
              address1: "Bole",
              address2: "Near Edna Mall",
              city: "Addis Ababa",
              countryCode: "et",
              firstName: "Almaz",
              lastName: "Bekele",
              phone: "+251911234567",
              postalCode: null,
              province: "Addis Ababa",
            },
            status: "pending",
            total: 250,
            updatedAt: "2026-09-29T08:00:00.000Z",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        issueMerchantSalesDocument: async (input) => ({
          document: {
            contentHash: "hash_1",
            createdAt: input.snapshot.issuedAt,
            id: "document_1",
            kind: input.snapshot.kind,
            language: input.snapshot.language,
            number: "OP-000001",
            orderId: input.snapshot.order.id,
            snapshot: input.snapshot,
          },
        }),
      },
    );

    const response = await app.request("/platform/merchant/orders/order_1/documents", {
      body: JSON.stringify({ kind: "order_summary", language: "am" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
        "Idempotency-Key": "document-issue-1",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.document.kind, "order_summary");
    assert.equal(body.document.snapshot.currencyCode, "etb");
    assert.equal(body.document.snapshot.orderReference, "ORD-1001");
    assert.equal(body.document.snapshot.complianceStatus, "operational_only");
    assert.match(body.document.snapshot.disclaimer, /የታክስ ደረሰኝ አይደለም/u);
  });

  it("does not call an authorization a payment receipt", async () => {
    let issueCalls = 0;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getMerchantOrder: async () => ({
          ok: true,
          order: {
            createdAt: "2026-09-29T08:00:00.000Z",
            currencyCode: "etb",
            customDisplayId: "ORD-1001",
            displayId: 1001,
            email: null,
            fulfillmentStatus: "not_fulfilled",
            id: "order_1",
            items: [],
            paymentStatus: "authorized",
            refundedTotal: 0,
            status: "pending",
            total: 250,
            updatedAt: "2026-09-29T08:00:00.000Z",
          },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        issueMerchantSalesDocument: async () => {
          issueCalls += 1;
          throw new Error("must not issue");
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/order_1/documents", {
      body: JSON.stringify({ kind: "payment_receipt", language: "en" }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
        "Idempotency-Key": "document-receipt-1",
      },
      method: "POST",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "payment_receipt_requires_payment" });
    assert.equal(issueCalls, 0);
  });

  it("scopes document reads to the resolved tenant", async () => {
    const reads: Array<{ documentId?: string; orderId?: string; tenantId: string }> = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getMerchantSalesDocument: async (input) => {
          reads.push(input);
          return null;
        },
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        listMerchantSalesDocuments: async (input) => {
          reads.push(input);
          return [];
        },
      },
    );

    const listResponse = await app.request("/platform/merchant/orders/order_1/documents", {
      headers: { Host: "abebe.lvh.me" },
    });
    const getResponse = await app.request("/platform/merchant/sales-documents/document_1", {
      headers: { Host: "abebe.lvh.me" },
    });

    assert.equal(listResponse.status, 200);
    assert.equal(getResponse.status, 404);
    assert.deepEqual(reads, [
      { orderId: "order_1", tenantId: resolvedTenantContext.tenantId },
      { documentId: "document_1", tenantId: resolvedTenantContext.tenantId },
    ]);
  });
});
