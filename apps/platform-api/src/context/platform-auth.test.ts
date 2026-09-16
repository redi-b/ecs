import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getEmailVerificationActionUrl,
  getPasswordResetActionUrl,
  getPlatformAuthCookieOptions,
  requiresVerifiedEmailForInvitation,
} from "./platform-auth.js";

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

test("invitation verification follows the account email-verification policy", () => {
  assert.equal(requiresVerifiedEmailForInvitation(), false);
  assert.equal(requiresVerifiedEmailForInvitation(false), false);
  assert.equal(requiresVerifiedEmailForInvitation(true), true);
});

test("password reset emails use an app-hosted verification link", () => {
  assert.equal(
    getPasswordResetActionUrl({
      dashboardPublicBaseUrl: "https://app.example.com",
      generatedUrl:
        "https://api.example.com/platform/auth/reset-password/reset-token?callbackURL=https%3A%2F%2Fshop.example.com%2Freset-password",
      token: "reset-token",
    }),
    "https://shop.example.com/reset-password/verify?token=reset-token",
  );
});

test("email actions use an app-hosted confirmation link and preserve the return path", () => {
  assert.equal(
    getEmailVerificationActionUrl({
      dashboardPublicBaseUrl: "https://app.example.com",
      generatedUrl:
        "https://api.example.com/platform/auth/verify-email?token=verify-token&callbackURL=https%3A%2F%2Fshop.example.com%2Fdashboard%2Fsettings%3Ftab%3Daccount",
      intent: "approve-email-change",
      token: "verify-token",
    }),
    "https://shop.example.com/verify-email?token=verify-token&intent=approve-email-change&returnTo=%2Fdashboard%2Fsettings%3Ftab%3Daccount",
  );
});

test("new-account verification uses Better Auth's one-click link", () => {
  const generatedUrl =
    "https://api.example.com/platform/auth/verify-email?token=verify-token&callbackURL=https%3A%2F%2Fapp.example.com%2Fsign-in%3Fverified%3D1";
  assert.equal(
    getEmailVerificationActionUrl({
      dashboardPublicBaseUrl: "https://app.example.com",
      generatedUrl,
      intent: "verify-email",
      token: "verify-token",
    }),
    generatedUrl,
  );
});

test("the new-address verification link completes through Better Auth", () => {
  const generatedUrl =
    "https://api.example.com/platform/auth/verify-email?token=new-token&callbackURL=https%3A%2F%2Fshop.example.com%2Fverify-email%2Fresult%3Fintent%3Dapprove-email-change%26returnTo%3D%252Fdashboard%252Fsettings%253Ftab%253Daccount%2526emailChanged%253D1";
  assert.equal(
    getEmailVerificationActionUrl({
      dashboardPublicBaseUrl: "https://app.example.com",
      generatedUrl,
      intent: "verify-email",
      token: "new-token",
    }),
    generatedUrl,
  );
});
