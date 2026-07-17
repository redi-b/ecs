import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_AUTH_COOKIE_PREFIX,
  getAuthCookiePrefix,
  getAuthSessionCookieBaseName,
  getAuthSessionCookieNames,
  getAuthSessionCookieNamesToClear,
} from "./auth-cookies";

describe("auth cookie naming", () => {
  it("defaults to ecs when env is empty", () => {
    assert.equal(getAuthCookiePrefix({}), DEFAULT_AUTH_COOKIE_PREFIX);
    assert.equal(getAuthCookiePrefix({ BETTER_AUTH_COOKIE_PREFIX: "  " }), "ecs");
  });

  it("uses BETTER_AUTH_COOKIE_PREFIX when set", () => {
    assert.equal(getAuthCookiePrefix({ BETTER_AUTH_COOKIE_PREFIX: "my-shop" }), "my-shop");
    assert.equal(getAuthCookiePrefix({ BETTER_AUTH_COOKIE_PREFIX: "  acme  " }), "acme");
  });

  it("sanitizes invalid characters and secure prefixes", () => {
    assert.equal(getAuthCookiePrefix({ BETTER_AUTH_COOKIE_PREFIX: "__Secure-ecs" }), "ecs");
    assert.equal(getAuthCookiePrefix({ BETTER_AUTH_COOKIE_PREFIX: "ecs.auth!" }), "ecsauth");
  });

  it("builds session cookie names", () => {
    assert.equal(getAuthSessionCookieBaseName("ecs"), "ecs.session_token");
    assert.deepEqual(getAuthSessionCookieNames("ecs"), [
      "ecs.session_token",
      "__Secure-ecs.session_token",
    ]);
  });

  it("clears current and legacy better-auth cookies", () => {
    const names = getAuthSessionCookieNamesToClear("ecs");
    assert.ok(names.includes("ecs.session_token"));
    assert.ok(names.includes("__Secure-ecs.session_token"));
    assert.ok(names.includes("better-auth.session_token"));
    assert.ok(names.includes("__Secure-better-auth.session_token"));
  });
});
