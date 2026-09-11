import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { POST } from "./route.js";

const originalFetch = globalThis.fetch;
const originalPlatformApiBaseUrl = process.env.PLATFORM_API_BASE_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalPlatformApiBaseUrl === undefined) delete process.env.PLATFORM_API_BASE_URL;
  else process.env.PLATFORM_API_BASE_URL = originalPlatformApiBaseUrl;
});

test("shop selection validates membership before remembering and redirecting", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(request.url, "http://platform.test/platform/tenants/tenant_2");
    assert.equal(request.headers.get("cookie"), "better-auth.session_token=session_1");
    return Response.json({
      tenant: {
        createdAt: "2026-09-01T00:00:00.000Z",
        handle: "bole-style",
        id: "tenant_2",
        name: "Bole Style",
        primaryDomain: { hostname: "bole-style.lvh.me" },
        role: "staff",
        status: "active",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    });
  };

  const form = new FormData();
  form.set("tenantId", "tenant_2");
  const response = await POST(
    new Request("http://app.lvh.me/admin/shops/select", {
      body: form,
      headers: {
        cookie: "better-auth.session_token=session_1",
        "x-forwarded-host": "app.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://bole-style.lvh.me/admin");
  assert.match(response.headers.get("set-cookie") ?? "", /ecs_last_shop=tenant_2/);
});

test("shop selection does not remember a stale or unauthorized membership", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  globalThis.fetch = async () => Response.json({ error: "tenant_not_found" }, { status: 404 });
  const form = new FormData();
  form.set("tenantId", "removed");
  const response = await POST(
    new Request("http://app.lvh.me/admin/shops/select", { body: form, method: "POST" }),
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://app.lvh.me/admin/shops?error=shop_not_found",
  );
  assert.equal(response.headers.get("set-cookie"), null);
});
