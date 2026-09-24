import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createUmamiAnalyticsProvider } from "./umami-provider.js";

describe("Umami analytics provider", () => {
  it("authenticates once and normalizes website statistics", async () => {
    const requests: Array<{ body: string | null; path: string }> = [];
    const provider = createUmamiAnalyticsProvider({
      baseUrl: "https://analytics.example.com/",
      fetch: async (input, init) => {
        const url = new URL(String(input));
        requests.push({
          body: typeof init?.body === "string" ? init.body : null,
          path: url.pathname,
        });
        if (url.pathname === "/api/auth/login") {
          return Response.json({ token: "token-1" });
        }
        return Response.json({
          bounces: 6,
          pageviews: 42,
          totaltime: 1_566,
          visitors: 12,
          visits: 18,
        });
      },
      password: "password",
      username: "ecs",
    });

    const summary = await provider.getTrafficSummary({
      range: {
        from: new Date("2026-09-01T00:00:00Z"),
        timezone: "Africa/Addis_Ababa",
        to: new Date("2026-09-09T23:59:59Z"),
      },
      siteId: "site-1",
    });

    assert.deepEqual(summary, {
      bounceRate: 1 / 3,
      pageViews: 42,
      visitDurationSeconds: 87,
      visitors: 12,
      visits: 18,
    });
    assert.deepEqual(
      requests.map((request) => request.path),
      ["/api/auth/login", "/api/websites/site-1/stats"],
    );
  });

  it("provisions a shop without exposing provider fields to callers", async () => {
    let provisionBody: unknown;
    const provider = createUmamiAnalyticsProvider({
      baseUrl: "https://analytics.example.com",
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path === "/api/auth/login") return Response.json({ token: "token-1" });
        provisionBody = JSON.parse(String(init?.body));
        return Response.json({ id: "tenant-site-id" });
      },
      password: "password",
      username: "ecs",
    });

    const result = await provider.provisionSite({
      domain: "shop.example.com",
      name: "Example shop",
      requestedId: "tenant-id",
    });

    assert.deepEqual(result, { siteId: "tenant-site-id" });
    assert.deepEqual(provisionBody, {
      domain: "shop.example.com",
      id: "tenant-id",
      name: "Example shop",
    });
  });

  it("provisions when Umami v3 returns 200 null for a missing requested website", async () => {
    const requests: Array<{ body: unknown; method: string; path: string }> = [];
    const provider = createUmamiAnalyticsProvider({
      baseUrl: "https://analytics.example.com",
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname;
        const method = init?.method ?? "GET";
        if (path === "/api/auth/login") return Response.json({ token: "token-1" });
        requests.push({
          body: init?.body ? JSON.parse(String(init.body)) : null,
          method,
          path,
        });
        if (method === "GET") return Response.json(null);
        return Response.json({ id: "tenant-id" });
      },
      password: "password",
      username: "ecs",
    });

    const result = await provider.ensureSite({
      domain: "shop.example.com",
      name: "Example shop",
      requestedId: "tenant-id",
    });

    assert.deepEqual(result, { siteId: "tenant-id" });
    assert.deepEqual(requests, [
      { body: null, method: "GET", path: "/api/websites/tenant-id" },
      {
        body: { domain: "shop.example.com", id: "tenant-id", name: "Example shop" },
        method: "POST",
        path: "/api/websites",
      },
    ]);
  });
});
