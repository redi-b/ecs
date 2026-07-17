import assert from "node:assert/strict";
import { test } from "node:test";

import { getPlatformAuthCookieOptions } from "./platform-auth.js";

test("production auth cookies are secure, branded, and shared across the parent domain", () => {
  const options = getPlatformAuthCookieOptions({
    cookieDomain: ".ecs.example.com",
    cookiePrefix: "ecs",
    useSecureCookies: true,
  });

  assert.equal(options.cookiePrefix, "ecs");
  assert.equal(options.trustedProxyHeaders, true);
  assert.equal(options.useSecureCookies, true);
  assert.deepEqual(options.crossSubDomainCookies, {
    domain: ".ecs.example.com",
    enabled: true,
  });
  assert.deepEqual(options.defaultCookieAttributes, {
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  });
  assert.ok(options.ipAddress?.ipAddressHeaders?.includes("x-forwarded-for"));
});

test("cookiePrefix falls back to ecs when omitted", () => {
  const previous = process.env.BETTER_AUTH_COOKIE_PREFIX;
  delete process.env.BETTER_AUTH_COOKIE_PREFIX;
  try {
    const options = getPlatformAuthCookieOptions({});
    assert.equal(options.cookiePrefix, "ecs");
  } finally {
    if (previous === undefined) delete process.env.BETTER_AUTH_COOKIE_PREFIX;
    else process.env.BETTER_AUTH_COOKIE_PREFIX = previous;
  }
});
