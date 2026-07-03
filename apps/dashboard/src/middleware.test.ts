import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { DASHBOARD_PATH_HEADER } from "./lib/dashboard-auth.js";
import { proxy } from "./proxy.js";

describe("dashboard proxy", () => {
  it("adds the dashboard path header for protected admin pages", () => {
    const request = new NextRequest("http://abebe.lvh.me/admin/products?page=2");
    const response = proxy(request);

    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(
      response.headers.get(`x-middleware-request-${DASHBOARD_PATH_HEADER}`),
      "/admin/products?page=2",
    );
    assert.ok(
      response.headers
        .get("x-middleware-override-headers")
        ?.includes(DASHBOARD_PATH_HEADER),
    );
    assert.equal(request.headers.get(DASHBOARD_PATH_HEADER), null);
  });

  it("does not add the dashboard path header for admin-like prefixes", () => {
    const request = new NextRequest("http://abebe.lvh.me/adminish/products");
    const response = proxy(request);

    assert.equal(response.headers.get("x-middleware-next"), "1");
    assertNoDashboardPathOverride(response);
  });

  for (const pathname of [
    "/admin/sign-in",
    "/admin/session",
    "/admin/storefront/template",
  ]) {
    it(`does not add the dashboard path header for ${pathname}`, () => {
      const request = new NextRequest(`http://abebe.lvh.me${pathname}`);
      const response = proxy(request);

      assert.equal(response.headers.get("x-middleware-next"), "1");
      assertNoDashboardPathOverride(response);
    });
  }
});

function assertNoDashboardPathOverride(response: Response) {
  assert.equal(
    response.headers.get(`x-middleware-request-${DASHBOARD_PATH_HEADER}`),
    null,
  );
}
