import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../../test/platform-app-harness.js";

describe("storefront inquiries", () => {
  it("validates and creates a tenant-scoped contact inquiry", async () => {
    let captured: Record<string, unknown> | undefined;
    let notificationType = "";
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        createStorefrontInquiry: async (input) => {
          captured = input;
          return {
            ok: true,
            inquiry: { id: "inquiry_1", createdAt: "2026-08-16T10:00:00.000Z" },
          };
        },
        recordNotificationEvent: async (input) => {
          notificationType = input.eventType;
          return { ok: true, logCount: 1, logIds: ["log_1"] };
        },
      },
    );

    const response = await app.request("/store/inquiries", {
      method: "POST",
      headers: { host: "abebe.lvh.me", "content-type": "application/json" },
      body: JSON.stringify({
        type: "contact",
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: null,
        subject: "Storefront inquiry",
        message: "Do you stock this item?",
        sourcePath: "/contact",
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(captured?.tenantId, "tenant_1");
    assert.equal(captured?.customerEmail, "jane@example.com");
    assert.equal(notificationType, "storefront.inquiry_created");
    assert.deepEqual(await response.json(), {
      inquiry: { id: "inquiry_1", createdAt: "2026-08-16T10:00:00.000Z" },
    });
  });

  it("rejects an inquiry without a reply channel", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      { createStorefrontInquiry: async () => { throw new Error("must not run"); } },
    );
    const response = await app.request("/store/inquiries", {
      method: "POST",
      headers: { host: "abebe.lvh.me", "content-type": "application/json" },
      body: JSON.stringify({
        type: "contact",
        customerName: "Jane Doe",
        subject: "Question",
        message: "Please reply.",
      }),
    });
    assert.equal(response.status, 400);
  });

  it("silently accepts honeypot submissions without persisting them", async () => {
    let called = false;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        createStorefrontInquiry: async () => {
          called = true;
          throw new Error("must not run");
        },
      },
    );
    const response = await app.request("/store/inquiries", {
      method: "POST",
      headers: { host: "abebe.lvh.me", "content-type": "application/json" },
      body: JSON.stringify({
        type: "contact",
        customerName: "Spam Bot",
        customerEmail: "bot@example.com",
        subject: "Question",
        message: "Spam",
        website: "https://spam.invalid",
      }),
    });
    assert.equal(response.status, 202);
    assert.equal(called, false);
  });
});

describe("merchant inquiry inbox", () => {
  it("lists only through an authorized tenant context", async () => {
    let tenantId = "";
    const app = appWithResolution({ ok: true, context: resolvedTenantContext }, {
      getSession: async () => ({ user: { id: "user_1", email: "owner@example.com", name: "Owner" } }),
      authorizeDashboardForTenant: async () => ({ ok: true, actor: { id: "user_1", email: "owner@example.com", name: "Owner", role: "owner" } }),
      listStorefrontInquiries: async (input) => { tenantId = input.tenantId; return { ok: true, inquiries: [], count: 0, limit: input.limit, offset: input.offset }; },
    });
    const response = await app.request("/platform/merchant/inquiries", { headers: { host: "abebe.lvh.me" } });
    assert.equal(response.status, 200);
    assert.equal(tenantId, "tenant_1");
  });
});
