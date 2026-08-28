import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { proxy } from "./proxy";

function request(host: string) {
  return new NextRequest("http://ops.lvh.me/", { headers: { host } });
}

test("operator proxy rejects non-ops hosts before routes execute", () => {
  assert.equal(proxy(request("shop.lvh.me")).status, 404);
  assert.equal(proxy(request("ops.lvh.me.attacker.test")).status, 404);
});

test("operator proxy adds private application security headers", () => {
  const response = proxy(request("ops.lvh.me:3002"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("content-security-policy"), "frame-ancestors 'none'");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});
