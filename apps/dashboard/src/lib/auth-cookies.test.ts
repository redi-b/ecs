import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { getSharedAuthCookieClears } from "./auth-cookies.js";

const originalCookieDomain = process.env.DASHBOARD_AUTH_COOKIE_DOMAIN;
const originalCookiePrefix = process.env.BETTER_AUTH_COOKIE_PREFIX;

afterEach(() => {
  if (originalCookieDomain === undefined) {
    delete process.env.DASHBOARD_AUTH_COOKIE_DOMAIN;
  } else {
    process.env.DASHBOARD_AUTH_COOKIE_DOMAIN = originalCookieDomain;
  }
  if (originalCookiePrefix === undefined) {
    delete process.env.BETTER_AUTH_COOKIE_PREFIX;
  } else {
    process.env.BETTER_AUTH_COOKIE_PREFIX = originalCookiePrefix;
  }
});

test("secure ECS auth cookies are cleared with matching security attributes", () => {
  process.env.DASHBOARD_AUTH_COOKIE_DOMAIN = ".ecs.example.com";
  delete process.env.BETTER_AUTH_COOKIE_PREFIX;

  const cookies = getSharedAuthCookieClears();

  assert.ok(cookies.some((c) => c.startsWith("ecs.session_token=")));
  assert.ok(cookies.some((c) => c.startsWith("__Secure-ecs.session_token=")));
  // Migration: still clear legacy better-auth cookies
  assert.ok(cookies.some((c) => c.startsWith("better-auth.session_token=")));
  assert.ok(cookies.some((c) => c.startsWith("__Secure-better-auth.session_token=")));

  const secure = cookies.find((c) => c.startsWith("__Secure-ecs.session_token="));
  assert.ok(secure);
  assert.match(secure ?? "", /; Secure;/);
  assert.match(secure ?? "", /Domain=\.ecs\.example\.com; Path=\//);

  const plain = cookies.find((c) => c.startsWith("ecs.session_token="));
  assert.ok(plain);
  assert.doesNotMatch(plain ?? "", /; Secure/);
});

test("custom BETTER_AUTH_COOKIE_PREFIX is honored when clearing", () => {
  process.env.DASHBOARD_AUTH_COOKIE_DOMAIN = ".example.com";
  process.env.BETTER_AUTH_COOKIE_PREFIX = "acme";

  const cookies = getSharedAuthCookieClears();
  assert.ok(cookies.some((c) => c.startsWith("acme.session_token=")));
  assert.ok(cookies.some((c) => c.startsWith("__Secure-acme.session_token=")));
});
