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

test("POST /onboarding/submit provisions a shop for the signed-in account", async () => {
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
    const pathname = new URL(request.url).pathname;
    if (pathname === "/platform/tenants/tenant_1/delivery") {
      return Response.json({
        delivery: {
          currency: "ETB",
          defaultDeliveryFee: "0",
          deliveryEnabled: false,
          landmarkRequired: false,
          notesEnabled: true,
          phoneConfirmationRequired: false,
          pickupEnabled: false,
          tenantId: "tenant_1",
          updatedAt: "2026-07-06T08:00:01.000Z",
          zones: [],
        },
      });
    }
    if (pathname === "/platform/tenants/tenant_1/storefront/draft") {
      const languageSettings =
        request.method === "POST"
          ? ((await request.clone().json()) as { languageSettings: unknown }).languageSettings
          : { defaultLocale: "en", enabledLocales: ["en"], sourceLocale: "en" };
      return Response.json({
        draft: {
          data: { home: {} },
          hasUnpublishedChanges: true,
          languageSettings,
          localizedContent: { locales: {}, version: 1 },
          published: null,
          seo: { description: null, socialImageUrl: null, title: null },
          source: "clean",
          templateId: "template_1",
          templateKey: "luvia@1",
          templateVersion: 1,
          tenantId: "tenant_1",
          themeTokens: { colors: {} },
          updatedAt: "2026-07-06T08:00:00.000Z",
        },
      });
    }
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
        redirectTo: "http://addis-pantry.lvh.me/dashboard",
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
  body.set("templateKey", "luvia@1");
  body.set("businessCategory", "Groceries");
  body.set("contactPhone", "+251911000000");

  const response = await POST(
    new Request("http://app.lvh.me/onboarding/submit", {
      body,
      headers: {
        cookie: "better-auth.session_token=session_1",
        "x-forwarded-host": "app.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://addis-pantry.lvh.me/dashboard");
  assert.equal(forwardedRequest?.url, "http://platform.test/platform/tenants");
  assert.equal(forwardedRequest?.headers.get("cookie"), "better-auth.session_token=session_1");
  assert.deepEqual(forwardedRequest?.body, {
    businessCategory: "Groceries",
    contactPhone: "+251911000000",
    handle: "addis-pantry",
    name: "Addis Pantry",
    templateKey: "luvia@1",
  });
});

test("POST /onboarding/submit requires an existing session", async () => {
  const body = new FormData();
  body.set("shopName", "Addis Pantry");
  body.set("handle", "addis-pantry");
  body.set("templateKey", "luvia@1");

  const response = await POST(
    new Request("http://app.lvh.me/onboarding/submit", {
      body,
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://app.lvh.me/onboarding?error=auth_required&shopName=Addis+Pantry&handle=addis-pantry",
  );
});

test("POST /onboarding/submit requires a category and contact phone", async () => {
  const response = await POST(
    new Request("http://app.lvh.me/onboarding/submit", {
      body: JSON.stringify({
        handle: "addis-pantry",
        shopName: "Addis Pantry",
        templateKey: "luvia@1",
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: "better-auth.session_token=session_1",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "missing_required_fields",
    ok: false,
  });
});
