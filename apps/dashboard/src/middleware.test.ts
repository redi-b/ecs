import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { DASHBOARD_PATH_HEADER } from "./lib/dashboard-auth.js";
import { middleware } from "./middleware.js";

describe("dashboard middleware", () => {
  it("adds the dashboard path header for protected admin pages", () => {
    const request = new NextRequest("http://abebe.lvh.me/admin/products?page=2");
    const response = middleware(request);

    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(request.headers.get(DASHBOARD_PATH_HEADER), null);
  });

  it("does not redirect or mutate sign-in requests", () => {
    const request = new NextRequest("http://abebe.lvh.me/admin/sign-in?next=/admin");
    const response = middleware(request);

    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});
