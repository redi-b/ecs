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
    "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
  );
  assert.equal(forwardedRequest?.url, "http://platform.test/platform/auth/sign-in/email");
  assert.deepEqual(forwardedRequest?.body, {
    email: "owner@abebe.local",
    password: "password1234",
    rememberMe: true,
  });
  assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "dashboard.lvh.me");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-proto"), "http");
});

test("POST /admin/session rejects unsafe next redirects", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ user: { id: "user_1" } }), {
      headers: {
        "content-type": "application/json",
        "set-cookie": "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
      },
      status: 200,
    });

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
