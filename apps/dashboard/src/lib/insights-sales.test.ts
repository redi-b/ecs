import assert from "node:assert/strict";
import { it } from "node:test";
import { getInsightsSales, getInsightsDemand } from "./insights-sales";

it("demand reporting preserves scope, cookies, errors and response validation", async () => {
  const options = {
    tenantId: "shop_1",
    cookieHeader: "session=test",
    platformApiBaseUrl: "https://api.example.com",
    query: {
      from: "2026-09-01",
      to: "2026-09-13",
      comparison: "none" as const,
      page: 1,
      pageSize: 20,
      q: "shirt",
      sort: "views" as const,
    },
  };
  const result = await getInsightsDemand({
    ...options,
    fetcher: async (url, init) => {
      assert.equal(new URL(String(url)).pathname, "/platform/tenants/shop_1/insights/demand");
      assert.equal(new Headers(init?.headers).get("cookie"), "session=test");
      assert.equal(init?.cache, "no-store");
      return new Response("{}");
    },
  });
  assert.deepEqual(result, { ok: false, status: 502 });
  assert.deepEqual(
    await getInsightsDemand({
      ...options,
      fetcher: async () => new Response(null, { status: 403 }),
    }),
    { ok: false, status: 403 },
  );
});

it("forwards auth and selects the scoped reporting endpoint without fetching the dashboard", async () => {
  const result = await getInsightsSales({
    platformApiBaseUrl: "https://api.example.com",
    tenantId: "shop_1",
    requestHost: "shop.example.com",
    cookieHeader: "session=test",
    query: { from: "2026-09-01", to: "2026-09-13", comparison: "previous" },
    fetcher: async (url, options) => {
      assert.equal(
        String(url),
        "https://api.example.com/platform/tenants/shop_1/insights/sales?from=2026-09-01&to=2026-09-13&comparison=previous",
      );
      assert.equal(new Headers(options?.headers).get("cookie"), "session=test");
      assert.equal(options?.cache, "no-store");
      return new Response("{}", { status: 200 });
    },
  });
  assert.deepEqual(result, { ok: false, status: 502 });
});

it("preserves permission errors and handles network failure", async () => {
  const options = { query: { from: "2026-09-01", to: "2026-09-13", comparison: "none" as const } };
  assert.deepEqual(
    await getInsightsSales({
      ...options,
      fetcher: async () => new Response(null, { status: 403 }),
    }),
    { ok: false, status: 403 },
  );
  assert.deepEqual(
    await getInsightsSales({
      ...options,
      fetcher: async () => {
        throw new Error("offline");
      },
    }),
    { ok: false, status: 503 },
  );
});
