import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appWithResolution,
  resolvedTenantContext,
} from "../../../test/support/platform-app-harness.js";

const session = { user: { id: "user_1", email: "owner@example.com", name: "Owner" } };

describe("merchant expenses routes", () => {
  it("binds reads to the resolved tenant and the Insights permission", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getSession: async () => session,
        authorizeDashboardForTenant: async (input) => {
          assert.deepEqual(input.permission, { insights: ["read"] });
          return { ok: true, actor: { ...session.user, role: "viewer" } };
        },
        listMerchantExpenses: async (input) => {
          assert.equal(input.tenantId, resolvedTenantContext.tenantId);
          return {
            count: 0,
            expenses: [],
            limit: input.limit,
            offset: input.offset,
            totalAmount: 0,
          };
        },
      },
    );
    const response = await app.request("/platform/merchant/expenses", {
      headers: { host: resolvedTenantContext.hostname },
    });
    assert.equal(response.status, 200);
  });

  it("forwards validated workspace search and filters to the tenant-scoped store", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getSession: async () => session,
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { ...session.user, role: "viewer" },
        }),
        listMerchantExpenses: async (input) => {
          assert.deepEqual(input, {
            category: "delivery_transport",
            from: "2026-09-01",
            limit: 25,
            offset: 50,
            q: "Meskel",
            status: "active",
            tenantId: resolvedTenantContext.tenantId,
            to: "2026-09-30",
          });
          return {
            count: 0,
            expenses: [],
            limit: input.limit,
            offset: input.offset,
            totalAmount: 0,
          };
        },
      },
    );

    const response = await app.request(
      "/platform/merchant/expenses?q=Meskel&category=delivery_transport&status=active&from=2026-09-01&to=2026-09-30&limit=25&offset=50",
      { headers: { host: resolvedTenantContext.hostname } },
    );

    assert.equal(response.status, 200);
  });

  it("binds estimated profit to the resolved tenant and commerce channel", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getSession: async () => session,
        authorizeDashboardForTenant: async (input) => {
          assert.deepEqual(input.permission, { insights: ["read"] });
          return { ok: true, actor: { ...session.user, role: "viewer" } };
        },
        getMerchantEstimatedProfit: async (input) => {
          assert.deepEqual(input, {
            from: "2026-09-01",
            salesChannelId: resolvedTenantContext.medusaSalesChannelId,
            tenantId: resolvedTenantContext.tenantId,
            to: "2026-09-30",
          });
          return {
            ok: true,
            computedAt: "2026-09-30T10:00:00.000Z",
            currencyCode: "etb",
            from: input.from,
            summary: {
              amount: 75,
              coverage: "complete",
              expenses: 5,
              excludedOrders: 0,
              knownProductCost: 20,
              ordersMissingCost: 0,
              recognizedOrders: 1,
              recognizedSales: 100,
              recordedRefunds: 0,
            },
            to: input.to,
          };
        },
      },
    );
    const response = await app.request(
      "/platform/merchant/expenses/estimated-profit?from=2026-09-01&to=2026-09-30",
      { headers: { host: resolvedTenantContext.hostname } },
    );
    assert.equal(response.status, 200);
  });

  it("requires a replay key and scopes creation to the authenticated tenant and actor", async () => {
    const created: unknown[] = [];
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getSession: async () => session,
        authorizeDashboardForTenant: async (input) => {
          assert.deepEqual(input.permission, { settings: ["manage"] });
          return { ok: true, actor: { ...session.user, role: "owner" } };
        },
        createMerchantExpense: async (input) => {
          created.push(input);
          return {
            expense: {
              ...input,
              createdAt: "2026-09-29T10:00:00.000Z",
              id: "expense_1",
              status: "active",
              updatedAt: "2026-09-29T10:00:00.000Z",
              voidedAt: null,
              voidedByUserId: null,
            },
          };
        },
        executeMerchantMutation: async (_input, mutation) => ({
          ok: true,
          replayed: false,
          value: await mutation(),
        }),
      },
    );
    const request = (key?: string) =>
      app.request("/platform/merchant/expenses", {
        body: JSON.stringify({ amount: 12_500, category: "fees", occurredOn: "2026-09-29" }),
        headers: {
          "content-type": "application/json",
          host: resolvedTenantContext.hostname,
          ...(key ? { "idempotency-key": key } : {}),
        },
        method: "POST",
      });
    assert.equal((await request()).status, 400);
    assert.equal((await request("expense-key-1")).status, 201);
    assert.deepEqual(created, [
      {
        actorUserId: "user_1",
        amount: 12_500,
        category: "fees",
        currencyCode: "etb",
        occurredOn: "2026-09-29",
        tenantId: resolvedTenantContext.tenantId,
      },
    ]);
  });
});
