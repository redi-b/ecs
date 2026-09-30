import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appWithResolution,
  resolvedTenantContext,
} from "../../../test/support/platform-app-harness.js";

const session = { user: { id: "user_1", email: "owner@example.com", name: "Owner" } };

describe("merchant documents workspace", () => {
  it("combines only tenant-scoped immutable documents and applies server-owned filters", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        getSession: async () => session,
        authorizeDashboardForTenant: async (input) => {
          assert.deepEqual(input.permission, { orders: ["read"] });
          return { ok: true, actor: { ...session.user, role: "viewer" } };
        },
        listMerchantSalesDocuments: async (input) => {
          assert.equal(input.tenantId, resolvedTenantContext.tenantId);
          assert.equal(input.orderId, undefined);
          return [];
        },
        listMerchantQuotations: async (input) => {
          assert.equal(input.tenantId, resolvedTenantContext.tenantId);
          return {
            count: 0,
            limit: input.limit,
            offset: input.offset,
            ok: true as const,
            quotations: [],
          };
        },
      },
    );

    const response = await app.request(
      "/platform/merchant/documents?q=Bole&kind=quotation&from=2026-09-01&to=2026-09-30&limit=25&offset=50",
      { headers: { host: resolvedTenantContext.hostname } },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      count: 0,
      documents: [],
      limit: 25,
      offset: 50,
    });
  });
});
