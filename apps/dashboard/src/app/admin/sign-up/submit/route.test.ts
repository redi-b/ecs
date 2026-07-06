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

test("POST /admin/sign-up/submit creates an account and redirects to onboarding", async () => {
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
  body.set("ownerName", "Mahi Bekele");
  body.set("email", " MAHI@EXAMPLE.COM ");
  body.set("password", "password1234");

  const response = await POST(
    new Request("http://dashboard.lvh.me/admin/sign-up/submit", {
      body,
      headers: {
        "x-forwarded-host": "dashboard.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://dashboard.lvh.me/admin/onboarding");
  assert.equal(
    response.headers.get("set-cookie"),
    "better-auth.session_token=session_1; HttpOnly; SameSite=Lax; Domain=.lvh.me; Path=/",
  );
  assert.equal(forwardedRequest?.url, "http://platform.test/platform/auth/sign-up/email");
  assert.deepEqual(forwardedRequest?.body, {
    email: "mahi@example.com",
    name: "Mahi Bekele",
    password: "password1234",
  });
  assert.equal(forwardedRequest?.headers.get("origin"), "http://dashboard.lvh.me");
});

test("POST /admin/sign-up/submit redirects back when platform auth does not return a session cookie", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ user: { id: "user_1" } }), {
      headers: {
        "content-type": "application/json",
      },
      status: 200,
    });

  const body = new FormData();
  body.set("ownerName", "Mahi Bekele");
  body.set("email", "mahi@example.com");
  body.set("password", "password1234");

  const response = await POST(
    new Request("http://dashboard.lvh.me/admin/sign-up/submit", {
      body,
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://dashboard.lvh.me/admin/sign-up?error=auth_session_missing&ownerName=Mahi+Bekele&email=mahi%40example.com",
  );
});
