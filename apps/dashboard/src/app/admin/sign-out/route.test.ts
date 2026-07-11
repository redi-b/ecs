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

test("POST /admin/sign-out signs out through Platform auth and forwards clearing cookies", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";

  let forwardedRequest:
    | {
        headers: Headers;
        method: string;
        url: string;
      }
    | undefined;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    forwardedRequest = {
      headers: request.headers,
      method: request.method,
      url: request.url,
    };

    return Response.json(
      { success: true },
      {
        headers: {
          "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
        },
      },
    );
  };

  const response = await POST(
    new Request("http://dashboard.test/admin/sign-out", {
      headers: {
        cookie: "better-auth.session_token=session_1",
        "x-forwarded-host": "abebe.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://abebe.lvh.me/admin/sign-in");
  const setCookie = response.headers.get("set-cookie") ?? "";

  assert.match(
    setCookie,
    /better-auth\.session_token=; Max-Age=0; HttpOnly; SameSite=Lax; Domain=\.lvh\.me; Path=\//,
  );
  assert.match(
    setCookie,
    /better-auth\.session_token=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Domain=\.lvh\.me; Path=\//,
  );
  assert.match(
    setCookie,
    /__Secure-better-auth\.session_token=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure; Domain=\.lvh\.me; Path=\//,
  );
  assert.notEqual(
    setCookie,
    "better-auth.session_token=; Max-Age=0; HttpOnly; SameSite=Lax; Domain=.lvh.me; Path=/",
  );
  assert.equal(forwardedRequest?.method, "POST");
  assert.equal(forwardedRequest?.url, "http://platform.test/platform/auth/sign-out");
  assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  assert.equal(forwardedRequest?.headers.get("origin"), "http://abebe.lvh.me");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-host"), "abebe.lvh.me");
  assert.equal(forwardedRequest?.headers.get("x-forwarded-proto"), "http");
});
