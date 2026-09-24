import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { DASHBOARD_PATH_HEADER } from "./lib/dashboard-auth.js";
import { proxy } from "./proxy.js";

describe("dashboard proxy", () => {
  it("permanently redirects the legacy dashboard host to the canonical app host", () => {
    const previousCanonical = process.env.DASHBOARD_PUBLIC_BASE_URL;
    const previousLegacy = process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL;
    process.env.DASHBOARD_PUBLIC_BASE_URL = "https://app.example.com";
    process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL = "https://dashboard.example.com";
    try {
      const request = new NextRequest("https://dashboard.example.com/dashboard/products?page=2");
      const response = proxy(request);

      assert.equal(response.status, 308);
      assert.equal(
        response.headers.get("location"),
        "https://app.example.com/dashboard/products?page=2",
      );
    } finally {
      if (previousCanonical === undefined) delete process.env.DASHBOARD_PUBLIC_BASE_URL;
      else process.env.DASHBOARD_PUBLIC_BASE_URL = previousCanonical;
      if (previousLegacy === undefined) delete process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL;
      else process.env.DASHBOARD_LEGACY_PUBLIC_BASE_URL = previousLegacy;
    }
  });

  it("adds the dashboard path header for protected admin pages", () => {
    const request = new NextRequest("http://abebe.lvh.me/dashboard/products?page=2");
    const response = proxy(request);

    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(
      response.headers.get(`x-middleware-request-${DASHBOARD_PATH_HEADER}`),
      "/dashboard/products?page=2",
    );
    assert.ok(
      response.headers.get("x-middleware-override-headers")?.includes(DASHBOARD_PATH_HEADER),
    );
    assert.equal(request.headers.get(DASHBOARD_PATH_HEADER), null);
  });

  it("does not add the dashboard path header for admin-like prefixes", () => {
    const request = new NextRequest("http://abebe.lvh.me/dashboardish/products");
    const response = proxy(request);

    assert.equal(response.headers.get("x-middleware-next"), "1");
    assertNoDashboardPathOverride(response);
  });

  for (const pathname of ["/sign-in", "/session", "/dashboard/storefront/template"]) {
    it(`does not add the dashboard path header for ${pathname}`, () => {
      const request = new NextRequest(`http://abebe.lvh.me${pathname}`);
      const response = proxy(request);

      assert.equal(response.headers.get("x-middleware-next"), "1");
      assertNoDashboardPathOverride(response);
    });
  }
});

function assertNoDashboardPathOverride(response: Response) {
  assert.equal(response.headers.get(`x-middleware-request-${DASHBOARD_PATH_HEADER}`), null);
}
