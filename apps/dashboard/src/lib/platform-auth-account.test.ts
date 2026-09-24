import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  changeAccountEmail,
  getAccountIdentity,
  getSafeAccountReturnPath,
  getSafeVerificationReturnPath,
  preflightAccountPasswordReset,
  requestAccountPasswordReset,
  resetAccountPassword,
  updateAccountProfile,
  verifyAccountEmail,
} from "./platform-auth-account.js";

const originalFetch = globalThis.fetch;

test("profile updates forward avatar preferences with trusted auth headers", async () => {
  let captured: Request | undefined;
  globalThis.fetch = async (input, init) => {
    captured = new Request(input, init);
    return Response.json({ status: true });
  };
  const avatarPreferences = JSON.stringify({ version: 1, color: "blue", variation: 7 });
  const result = await updateAccountProfile({
    name: " Liya ",
    avatarPreferences,
    cookieHeader: "ecs.session_token=test",
    origin: "https://shop.example.com",
    platformApiBaseUrl: "https://api.example.com",
  });
  assert.equal(result.ok, true);
  assert.equal(captured?.headers.get("cookie"), "ecs.session_token=test");
  assert.equal(captured?.headers.get("origin"), "https://shop.example.com");
  assert.deepEqual(await captured?.json(), { name: "Liya", avatarPreferences });
});

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
    redirectTo: "https://app.example.com/reset-password",
  });

  assert.equal(result.ok, true);
  assert.equal(captured?.url, "https://api.example.com/platform/auth/request-password-reset");
  assert.equal(captured?.headers.get("origin"), "https://app.example.com");
  assert.deepEqual(await captured?.json(), {
    email: "owner@example.com",
    redirectTo: "https://app.example.com/reset-password",
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
        location: "https://app.example.com/reset-password?token=secret-token",
      },
      status: 302,
    });
  };

  const redirectUrl = await preflightAccountPasswordReset({
    callbackURL: "https://app.example.com/reset-password",
    origin: "https://app.example.com",
    platformApiBaseUrl: "https://api.example.com",
    token: "secret-token",
  });

  assert.equal(
    captured?.url,
    "https://api.example.com/platform/auth/reset-password/secret-token?callbackURL=https%3A%2F%2Fapp.example.com%2Freset-password",
  );
  assert.equal(captured?.redirect, "manual");
  assert.equal(redirectUrl, "https://app.example.com/reset-password?token=secret-token");
});

test("account return paths remain local to dashboard routes", () => {
  assert.equal(
    getSafeAccountReturnPath("/dashboard/settings?tab=account"),
    "/dashboard/settings?tab=account",
  );
  assert.equal(getSafeAccountReturnPath("https://evil.example/path"), "/sign-in");
  assert.equal(getSafeAccountReturnPath("//evil.example/path"), "/sign-in");
  assert.equal(getSafeAccountReturnPath("/storefront"), "/sign-in");
});

test("verification return paths preserve safe public auth destinations", () => {
  assert.equal(
    getSafeVerificationReturnPath("/sign-in?verified=1"),
    "/sign-in?verified=1",
  );
  assert.equal(
    getSafeVerificationReturnPath("/accept-invitation?invitationId=invite_1"),
    "/accept-invitation?invitationId=invite_1",
  );
  assert.equal(getSafeVerificationReturnPath("https://evil.example/path"), "/sign-in");
});

test("email verification delegates mutation to Better Auth and returns session cookies", async () => {
  globalThis.fetch = async () =>
    new Response(null, {
      headers: {
        location: "https://app.example.com/verify-email/result?intent=verify-email",
        "set-cookie": "ecs.session_token=session_2; Path=/; HttpOnly",
      },
      status: 302,
    });

  const result = await verifyAccountEmail({
    callbackURL: "https://app.example.com/verify-email/result?intent=verify-email",
    origin: "https://app.example.com",
    platformApiBaseUrl: "https://api.example.com",
    token: "verify-token",
  });

  assert.equal(
    result?.redirectUrl,
    "https://app.example.com/verify-email/result?intent=verify-email",
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
    callbackURL: "https://bole.example.com/dashboard/settings?tab=account",
    cookieHeader: "ecs.session_token=session_1",
    newEmail: " NEW@EXAMPLE.COM ",
    origin: "https://bole.example.com",
    platformApiBaseUrl: "https://api.example.com",
  });

  assert.equal(captured?.headers.get("cookie"), "ecs.session_token=session_1");
  assert.deepEqual(await captured?.json(), {
    callbackURL: "https://bole.example.com/dashboard/settings?tab=account",
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
