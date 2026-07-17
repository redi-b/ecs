import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { POST } from "./route.js";

const originalFetch = globalThis.fetch;
const originalPlatformApiBaseUrl = process.env.PLATFORM_API_BASE_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalPlatformApiBaseUrl === undefined) {
    delete process.env.PLATFORM_API_BASE_URL;
  } else {
    process.env.PLATFORM_API_BASE_URL = originalPlatformApiBaseUrl;
  }
});

test("POST /admin/session signs in through the Better Auth email endpoint and forwards cookies", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";

  let forwardedRequest:
    | {
        body: unknown;
        headers: Headers;
        url: string;
      }
    | undefined;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);

    if (request.url === "http://platform.test/platform/merchant/host") {
      return new Response(JSON.stringify({ tenant: { id: "tenant_1" } }), {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      });
    }

    forwardedRequest = {
      body: await request.json(),
      headers: request.headers,
      url: request.url,
    };

    return new Response(JSON.stringify({ user: { id: "user_1" } }), {
      headers: {
        "content-type": "application/json",
        "set-cookie": "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
      },
      status: 200,
    });
  };

  const body = new FormData();
  body.set("email", " OWNER@ABEBE.LOCAL ");
  body.set("password", "password1234");
  body.set("next", "/admin/products");

  const response = await POST(
    new Request("http://dashboard.test/admin/session", {
      body,
      headers: {
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
        "x-forwarded-for": "203.0.113.50",
        "x-forwarded-host": "dashboard.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://dashboard.lvh.me/admin/products");
  assert.equal(
    response.headers.get("set-cookie"),
    "better-auth.session_token=session_1; HttpOnly; SameSite=Lax; Domain=.lvh.me; Path=/",
  );
  assert.equal(forwardedRequest?.url, "http://platform.test/platform/auth/sign-in/email");
  assert.deepEqual(forwardedRequest?.body, {
    email: "owner@abebe.local",
    password: "password1234",
    rememberMe: true,
  });
  assert.equal(forwardedRequest?.headers.get("origin"), "http://dashboard.lvh.me");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "dashboard.lvh.me");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-proto"), "http");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-for"), "203.0.113.50");
  assert.equal(forwardedRequest?.headers.get("x-real-ip"), "203.0.113.50");
  assert.match(forwardedRequest?.headers.get("user-agent") ?? "", /iPhone/);
});

test("POST /admin/session rejects unsafe next redirects", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";

  globalThis.fetch = async (input) => {
    const request = new Request(input);

    if (request.url === "http://platform.test/platform/merchant/host") {
      return new Response(JSON.stringify({ tenant: { id: "tenant_1" } }), {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ user: { id: "user_1" } }), {
      headers: {
        "content-type": "application/json",
        "set-cookie": "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
      },
      status: 200,
    });
  };

  const body = new FormData();
  body.set("email", "owner@abebe.local");
  body.set("password", "password1234");
  body.set("next", "https://evil.test/admin");

  const response = await POST(
    new Request("http://dashboard.test/admin/session", {
      body,
      headers: {
        "x-forwarded-host": "abebe.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://abebe.lvh.me/admin");
});

test("POST /admin/session routes central dashboard sign-in to the user's primary shop", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requestedUrls.push(request.url);

    if (request.url === "http://platform.test/platform/auth/sign-in/email") {
      return new Response(JSON.stringify({ user: { id: "user_1" } }), {
        headers: {
          "content-type": "application/json",
          "set-cookie": "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
        },
        status: 200,
      });
    }

    assert.equal(request.headers.get("cookie"), "better-auth.session_token=session_1");

    return new Response(
      JSON.stringify({
        user: {
          id: "user_1",
          email: "owner@example.com",
          name: "Mahi Bekele",
        },
        tenants: [],
        primaryTenant: {
          id: "tenant_1",
          handle: "addis-pantry",
          primaryDomain: "addis-pantry.lvh.me",
          dashboardUrl: "http://addis-pantry.lvh.me/admin",
        },
        latestProvisioningAttempt: null,
      }),
      {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      },
    );
  };

  const body = new FormData();
  body.set("email", "owner@example.com");
  body.set("password", "password1234");
  body.set("next", "/admin");

  const response = await POST(
    new Request("http://dashboard.lvh.me/admin/session", {
      body,
      headers: {
        "x-forwarded-host": "dashboard.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://addis-pantry.lvh.me/admin");
  assert.deepEqual(requestedUrls, [
    "http://platform.test/platform/auth/sign-in/email",
    "http://platform.test/platform/onboarding/state",
  ]);
});
