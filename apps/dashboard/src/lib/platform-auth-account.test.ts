import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  changeAccountEmail,
  getAccountIdentity,
  getSafeAccountReturnPath,
  preflightAccountPasswordReset,
  requestAccountPasswordReset,
  resetAccountPassword,
  verifyAccountEmail,
} from "./platform-auth-account.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("password reset requests normalize the email and preserve the dashboard callback", async () => {
  let captured: Request | undefined;
  globalThis.fetch = async (input, init) => {
    captured = new Request(input, init);
    return Response.json({ status: true });
  };

  const result = await requestAccountPasswordReset({
    email: "  OWNER@EXAMPLE.COM ",
    origin: "https://app.example.com",
    platformApiBaseUrl: "https://api.example.com",
    redirectTo: "https://app.example.com/admin/reset-password",
  });

  assert.equal(result.ok, true);
  assert.equal(captured?.url, "https://api.example.com/platform/auth/request-password-reset");
  assert.equal(captured?.headers.get("origin"), "https://app.example.com");
  assert.deepEqual(await captured?.json(), {
    email: "owner@example.com",
    redirectTo: "https://app.example.com/admin/reset-password",
  });
});

test("password reset submits the token without placing it in the URL", async () => {
  let captured: Request | undefined;
  globalThis.fetch = async (input, init) => {
    captured = new Request(input, init);
    return Response.json({ status: true });
  };

  await resetAccountPassword({
    newPassword: "a-new-password",
    platformApiBaseUrl: "https://api.example.com",
    token: "secret-token",
  });

  assert.equal(captured?.url, "https://api.example.com/platform/auth/reset-password");
  assert.deepEqual(await captured?.json(), {
    newPassword: "a-new-password",
    token: "secret-token",
  });
});

test("password reset preflight delegates to Better Auth without consuming the token", async () => {
  let captured: Request | undefined;
  globalThis.fetch = async (input, init) => {
    captured = new Request(input, init);
    return new Response(null, {
      headers: {
        location: "https://app.example.com/admin/reset-password?token=secret-token",
      },
      status: 302,
    });
  };

  const redirectUrl = await preflightAccountPasswordReset({
    callbackURL: "https://app.example.com/admin/reset-password",
    origin: "https://app.example.com",
    platformApiBaseUrl: "https://api.example.com",
    token: "secret-token",
  });

  assert.equal(
    captured?.url,
    "https://api.example.com/platform/auth/reset-password/secret-token?callbackURL=https%3A%2F%2Fapp.example.com%2Fadmin%2Freset-password",
  );
  assert.equal(captured?.redirect, "manual");
  assert.equal(redirectUrl, "https://app.example.com/admin/reset-password?token=secret-token");
});

test("account return paths remain local to dashboard routes", () => {
  assert.equal(
    getSafeAccountReturnPath("/admin/settings?tab=account"),
    "/admin/settings?tab=account",
  );
  assert.equal(getSafeAccountReturnPath("https://evil.example/path"), "/admin/sign-in");
  assert.equal(getSafeAccountReturnPath("//evil.example/path"), "/admin/sign-in");
  assert.equal(getSafeAccountReturnPath("/storefront"), "/admin/sign-in");
});

test("email verification delegates mutation to Better Auth and returns session cookies", async () => {
  globalThis.fetch = async () =>
    new Response(null, {
      headers: {
        location: "https://app.example.com/admin/verify-email/result?intent=verify-email",
        "set-cookie": "ecs.session_token=session_2; Path=/; HttpOnly",
      },
      status: 302,
    });

  const result = await verifyAccountEmail({
    callbackURL: "https://app.example.com/admin/verify-email/result?intent=verify-email",
    origin: "https://app.example.com",
    platformApiBaseUrl: "https://api.example.com",
    token: "verify-token",
  });

  assert.equal(
    result?.redirectUrl,
    "https://app.example.com/admin/verify-email/result?intent=verify-email",
  );
  assert.deepEqual(result?.cookies, ["ecs.session_token=session_2; Path=/; HttpOnly"]);
});

test("email changes forward the current session and host-aware callback", async () => {
  let captured: Request | undefined;
  globalThis.fetch = async (input, init) => {
    captured = new Request(input, init);
    return Response.json({ status: true });
  };

  await changeAccountEmail({
    callbackURL: "https://bole.example.com/admin/settings?tab=account",
    cookieHeader: "ecs.session_token=session_1",
    newEmail: " NEW@EXAMPLE.COM ",
    origin: "https://bole.example.com",
    platformApiBaseUrl: "https://api.example.com",
  });

  assert.equal(captured?.headers.get("cookie"), "ecs.session_token=session_1");
  assert.deepEqual(await captured?.json(), {
    callbackURL: "https://bole.example.com/admin/settings?tab=account",
    newEmail: "new@example.com",
  });
});

test("account identity reports verification state from the current session", async () => {
  globalThis.fetch = async () =>
    Response.json({ user: { email: "owner@example.com", emailVerified: true } });

  const identity = await getAccountIdentity({ platformApiBaseUrl: "https://api.example.com" });

  assert.deepEqual(identity, {
    email: "owner@example.com",
    emailVerified: true,
    ok: true,
  });
});
