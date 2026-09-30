import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appWithResolution,
  resolvedTenantContext,
} from "../../../test/support/platform-app-harness.js";

const session = { user: { id: "cashier_1", email: "cashier@example.com", name: "Cashier" } };

describe("merchant quick-sale order creation", () => {
  it("creates a tenant-scoped walk-in Medusa order without inventing customer contact data", async () => {
    const calls: unknown[] = [];
    const envelopes: unknown[] = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getSession: async () => session,
        authorizeDashboardForTenant: async () => ({
          actor: { ...session.user, role: "staff" },
          ok: true,
        }),
        createMerchantManualOrder: async (input) => {
          calls.push(input);
          return { ok: true as const, order: { displayId: 7, id: "order_1", status: "pending" } };
        },
        executeMerchantMutation: async (input, mutation) => {
          envelopes.push(input);
          return { ok: true as const, replayed: false, value: await mutation() };
        },
      },
    );

    const response = await app.request("/platform/merchant/manual-orders", {
      body: JSON.stringify({
        channel: "pos",
        items: [{ quantity: 1, variantId: "variant_1" }],
      }),
      headers: {
        "content-type": "application/json",
        host: resolvedTenantContext.hostname,
        "idempotency-key": "quick-sale-1",
      },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.equal(calls.length, 1);
    const call = calls[0] as Record<string, unknown>;
    assert.match(String(call.customerEmail), /^walk-in@.+\.orders\.local$/);
    assert.equal(call.source, "pos");
    assert.equal(call.salesChannelId, resolvedTenantContext.medusaSalesChannelId);
    assert.equal(envelopes.length, 1);
    const envelope = envelopes[0] as Record<string, unknown>;
    assert.equal(envelope.operation, "assisted_sale.create");
    assert.equal(envelope.source, "pos");
  });

  it("requires order-update permission before accepting a manual price override", async () => {
    const permissions: unknown[] = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getSession: async () => session,
        authorizeDashboardForTenant: async (input) => {
          permissions.push(input.permission);
          return { actor: { ...session.user, role: "staff" }, ok: true };
        },
        createMerchantManualOrder: async () => ({
          ok: true as const,
          order: { displayId: 8, id: "order_2", status: "pending" },
        }),
      },
    );

    const response = await app.request("/platform/merchant/manual-orders", {
      body: JSON.stringify({
        adjustmentReason: "Counter markdown",
        channel: "pos",
        items: [{ quantity: 1, unitPrice: 90, variantId: "variant_1" }],
      }),
      headers: { "content-type": "application/json", host: resolvedTenantContext.hostname },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.deepEqual(permissions, [{ orders: ["create"] }, { orders: ["update"] }]);
  });

  it("records POS tender through the replay-safe ordinary order mutation", async () => {
    const mutations: unknown[] = [];
    const envelopes: unknown[] = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getSession: async () => session,
        authorizeDashboardForTenant: async (input) => {
          assert.deepEqual(input.permission, { orders: ["update"] });
          return { actor: { ...session.user, role: "staff" }, ok: true };
        },
        executeMerchantMutation: async (input, mutation) => {
          envelopes.push(input);
          return { ok: true as const, replayed: false, value: await mutation() };
        },
        mutateMerchantOrder: async (input) => {
          mutations.push(input);
          return {
            ok: true as const,
            order: {
              createdAt: "2026-09-30T10:00:00.000Z",
              currencyCode: "etb",
              displayId: 7,
              email: null,
              fulfillmentStatus: "not_fulfilled",
              id: "order_1",
              paymentStatus: "paid",
              status: "pending",
              total: 100,
              updatedAt: "2026-09-30T10:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/order_1/mark-paid", {
      body: JSON.stringify({ channel: "pos", settlementMethod: "cash" }),
      headers: {
        "content-type": "application/json",
        host: resolvedTenantContext.hostname,
        "idempotency-key": "quick-sale-1:payment",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal((mutations[0] as { source?: string }).source, "pos");
    assert.equal((envelopes[0] as { source?: string }).source, "pos");
    assert.equal((envelopes[0] as { operation?: string }).operation, "order.mark_paid");
  });
});
