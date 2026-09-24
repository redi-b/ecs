import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getOperationsAuthCookie,
  getOperationsAuthCookieClears,
  getPlatformAuthCookieHeader,
} from "./auth-cookies";

const originalOperationsPrefix = process.env.SUPERADMIN_AUTH_COOKIE_PREFIX;
const originalPlatformPrefix = process.env.BETTER_AUTH_COOKIE_PREFIX;

afterEach(() => {
  restore("SUPERADMIN_AUTH_COOKIE_PREFIX", originalOperationsPrefix);
  restore("BETTER_AUTH_COOKIE_PREFIX", originalPlatformPrefix);
});

test("operations cookies use a separate host-only namespace", () => {
  const cookie = getOperationsAuthCookie(
    "ecs.session_token=operator-secret; HttpOnly; SameSite=Lax; Domain=.lvh.me; Path=/",
  );

  assert.match(cookie, /^ecs-ops\.session_token=operator-secret;/);
  assert.doesNotMatch(cookie, /Domain=/i);
  assert.match(cookie, /Path=\//);
});

test("Platform requests use the operations session and ignore a simultaneous dashboard session", () => {
  const cookie = getPlatformAuthCookieHeader(
    "ecs.session_token=merchant-secret; ecs-ops.session_token=operator-secret; locale=en",
  );

  assert.equal(cookie, "ecs.session_token=operator-secret; locale=en");
});

test("operations sign-out never clears dashboard or legacy Better Auth sessions", () => {
  const cookies = getOperationsAuthCookieClears();

  assert.ok(
    cookies.every(
      (cookie) =>
        cookie.startsWith("ecs-ops.session_token=") ||
        cookie.startsWith("__Secure-ecs-ops.session_token="),
    ),
  );
  assert.ok(cookies.every((cookie) => !cookie.startsWith("ecs.session_token=")));
  assert.ok(cookies.every((cookie) => !cookie.startsWith("better-auth.session_token=")));
});

test("a conflicting operations prefix fails back to the separate namespace", () => {
  process.env.BETTER_AUTH_COOKIE_PREFIX = "ecs";
  process.env.SUPERADMIN_AUTH_COOKIE_PREFIX = "ecs";

  assert.match(
    getOperationsAuthCookie("ecs.session_token=operator-secret; Path=/"),
    /^ecs-ops\.session_token=/,
  );
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
