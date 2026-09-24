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

test("POST /session signs in through the Better Auth email endpoint and forwards cookies", async () => {
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
  body.set("next", "/dashboard/products");

  const response = await POST(
    new Request("http://dashboard.test/session", {
      body,
      headers: {
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
        "x-forwarded-for": "203.0.113.50",
        "x-forwarded-host": "app.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://app.lvh.me/dashboard/products");
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
  assert.equal(forwardedRequest?.headers.get("origin"), "http://app.lvh.me");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "app.lvh.me");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-proto"), "http");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-for"), "203.0.113.50");
  assert.equal(forwardedRequest?.headers.get("x-real-ip"), "203.0.113.50");
  assert.match(forwardedRequest?.headers.get("user-agent") ?? "", /iPhone/);
});

test("POST /session rejects unsafe next redirects", async () => {
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
  body.set("next", "https://evil.test/dashboard");

  const response = await POST(
    new Request("http://dashboard.test/session", {
      body,
      headers: {
        "x-forwarded-host": "abebe.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://abebe.lvh.me/dashboard");
});

test("POST /session reports an unverified account instead of an auth outage", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  globalThis.fetch = async () =>
    Response.json({ code: "EMAIL_NOT_VERIFIED", message: "Email not verified" }, { status: 403 });

  const response = await POST(
    new Request("http://app.lvh.me/session", {
      body: JSON.stringify({ email: "mahi@example.com", password: "password1234" }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-forwarded-host": "app.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "email_not_verified", ok: false });
});

test("POST /session routes central dashboard sign-in to the user's primary shop", async () => {
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
        tenants: [
          {
            createdAt: "2026-09-01T00:00:00.000Z",
            handle: "addis-pantry",
            id: "tenant_1",
            name: "Addis Pantry",
            primaryDomain: { hostname: "addis-pantry.lvh.me" },
            role: "owner",
            status: "active",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
        ],
        primaryTenant: {
          id: "tenant_1",
          handle: "addis-pantry",
          primaryDomain: "addis-pantry.lvh.me",
          dashboardUrl: "http://addis-pantry.lvh.me/dashboard",
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
  body.set("next", "/dashboard");

  const response = await POST(
    new Request("http://app.lvh.me/session", {
      body,
      headers: {
        "x-forwarded-host": "app.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://addis-pantry.lvh.me/dashboard");
  assert.deepEqual(requestedUrls, [
    "http://platform.test/platform/auth/sign-in/email",
    "http://platform.test/platform/operator/session",
    "http://platform.test/platform/onboarding/state",
  ]);
});

test("POST /session keeps Operations accounts out of merchant onboarding", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requestedUrls.push(request.url);

    if (request.url === "http://platform.test/platform/auth/sign-in/email") {
      return new Response(JSON.stringify({ user: { id: "operator_1" } }), {
        headers: {
          "content-type": "application/json",
          "set-cookie": "better-auth.session_token=operator_session; HttpOnly; SameSite=Lax",
        },
        status: 200,
      });
    }

    if (request.url === "http://platform.test/platform/operator/session") {
      assert.equal(request.headers.get("cookie"), "better-auth.session_token=operator_session");
      return Response.json({
        operator: { id: "operator_1", email: "operations@ecs.local", name: "ECS Operations" },
        principalId: "principal_1",
        permissions: ["platform.overview.read"],
      });
    }

    assert.equal(request.url, "http://platform.test/platform/auth/sign-out");
    return Response.json({ success: true });
  };

  const body = new FormData();
  body.set("email", "operations@ecs.local");
  body.set("password", "password1234");
  body.set("next", "/dashboard");

  const response = await POST(
    new Request("http://app.lvh.me/session", {
      body,
      headers: {
        "x-forwarded-host": "app.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://app.lvh.me/sign-in?error=invalid_credentials&next=%2Fdashboard",
  );
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(requestedUrls, [
    "http://platform.test/platform/auth/sign-in/email",
    "http://platform.test/platform/operator/session",
    "http://platform.test/platform/auth/sign-out",
  ]);
});
