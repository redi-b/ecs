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

test("POST /admin/onboarding/submit provisions a shop for the signed-in account", async () => {
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

    return new Response(
      JSON.stringify({
        tenant: {
          createdAt: "2026-07-06T08:00:00.000Z",
          id: "tenant_1",
          name: "Addis Pantry",
          handle: "addis-pantry",
          role: "owner",
          status: "active",
          primaryDomain: {
            hostname: "addis-pantry.lvh.me",
          },
          updatedAt: "2026-07-06T08:00:00.000Z",
        },
        redirectTo: "http://addis-pantry.lvh.me/admin",
      }),
      {
        headers: {
          "content-type": "application/json",
        },
        status: 201,
      },
    );
  };

  const body = new FormData();
  body.set("shopName", "Addis Pantry");
  body.set("handle", "addis-pantry");
  body.set("templateKey", "classic@1");
  body.set("businessCategory", "Groceries");

  const response = await POST(
    new Request("http://dashboard.lvh.me/admin/onboarding/submit", {
      body,
      headers: {
        cookie: "better-auth.session_token=session_1",
        "x-forwarded-host": "dashboard.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://addis-pantry.lvh.me/admin");
  assert.equal(forwardedRequest?.url, "http://platform.test/platform/tenants");
  assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  assert.deepEqual(forwardedRequest?.body, {
    businessCategory: "Groceries",
    handle: "addis-pantry",
    name: "Addis Pantry",
    templateKey: "classic@1",
  });
});

test("POST /admin/onboarding/submit requires an existing session", async () => {
  const body = new FormData();
  body.set("shopName", "Addis Pantry");
  body.set("handle", "addis-pantry");
  body.set("templateKey", "classic@1");

  const response = await POST(
    new Request("http://dashboard.lvh.me/admin/onboarding/submit", {
      body,
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://dashboard.lvh.me/admin/onboarding?error=auth_required&shopName=Addis+Pantry&handle=addis-pantry",
  );
});
