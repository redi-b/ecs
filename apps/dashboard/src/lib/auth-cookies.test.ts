import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { getSharedAuthCookieClears } from "./auth-cookies.js";

const originalCookieDomain = process.env.DASHBOARD_AUTH_COOKIE_DOMAIN;

afterEach(() => {
  if (originalCookieDomain === undefined) {
    delete process.env.DASHBOARD_AUTH_COOKIE_DOMAIN;
  } else {
    process.env.DASHBOARD_AUTH_COOKIE_DOMAIN = originalCookieDomain;
  }
});

test("secure Better Auth cookies are cleared with matching security attributes", () => {
  process.env.DASHBOARD_AUTH_COOKIE_DOMAIN = ".ecs.example.com";

  const cookies = getSharedAuthCookieClears();

  assert.match(cookies[0] ?? "", /better-auth\.session_token=/);
  assert.doesNotMatch(cookies[0] ?? "", /; Secure/);
  assert.match(cookies[1] ?? "", /__Secure-better-auth\.session_token=/);
  assert.match(cookies[1] ?? "", /; Secure;/);
  assert.match(cookies[1] ?? "", /Domain=\.ecs\.example\.com; Path=\//);
});
