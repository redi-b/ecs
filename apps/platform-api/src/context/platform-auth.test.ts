import assert from "node:assert/strict";
import { test } from "node:test";

import { getPlatformAuthCookieOptions } from "./platform-auth.js";

test("production auth cookies are secure and shared across the configured parent domain", () => {
  assert.deepEqual(
    getPlatformAuthCookieOptions({
      cookieDomain: ".ecs.example.com",
      useSecureCookies: true,
    }),
    {
      crossSubDomainCookies: {
        domain: ".ecs.example.com",
        enabled: true,
      },
      trustedProxyHeaders: true,
      useSecureCookies: true,
    },
  );
});
