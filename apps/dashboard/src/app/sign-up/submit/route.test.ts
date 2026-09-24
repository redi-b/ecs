import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { POST } from "./route.js";

const originalFetch = globalThis.fetch;
const originalPlatformApiBaseUrl = process.env.PLATFORM_API_BASE_URL;
const originalRequireEmailVerification = process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalPlatformApiBaseUrl === undefined) {
    delete process.env.PLATFORM_API_BASE_URL;
  } else {
    process.env.PLATFORM_API_BASE_URL = originalPlatformApiBaseUrl;
  }
  if (originalRequireEmailVerification === undefined) {
    delete process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;
  } else {
    process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = originalRequireEmailVerification;
  }
});

test("POST /sign-up/submit creates an account and redirects to onboarding", async () => {
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
  body.set("confirmPassword", "password1234");

  const response = await POST(
    new Request("http://app.lvh.me/sign-up/submit", {
      body,
      headers: {
        "x-forwarded-host": "app.lvh.me",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://app.lvh.me/onboarding");
  assert.equal(
    response.headers.get("set-cookie"),
    "better-auth.session_token=session_1; HttpOnly; SameSite=Lax; Domain=.lvh.me; Path=/",
  );
  assert.equal(forwardedRequest?.url, "http://platform.test/platform/auth/sign-up/email");
  assert.deepEqual(forwardedRequest?.body, {
    callbackURL: "http://app.lvh.me/sign-in?verified=1&next=%2Fonboarding",
    email: "mahi@example.com",
    name: "Mahi Bekele",
    password: "password1234",
  });
  assert.equal(forwardedRequest?.headers.get("origin"), "http://app.lvh.me");
});

test("POST /sign-up/submit asks the user to verify email when verification is required", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  delete process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;
  const requests: Array<{ body: unknown; url: string }> = [];

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push({ body: await request.json(), url: request.url });
    return request.url.endsWith("/sign-up/email")
      ? new Response(JSON.stringify({ token: null, user: { id: "user_1" } }), {
          headers: { "content-type": "application/json" },
          status: 200,
        })
      : new Response(JSON.stringify({ status: true }), { status: 200 });
  };

  const response = await POST(
    new Request("http://app.lvh.me/sign-up/submit", {
      body: JSON.stringify({
        confirmPassword: "password1234",
        email: "mahi@example.com",
        ownerName: "Mahi Bekele",
        password: "password1234",
      }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    redirectTo: "http://app.lvh.me/check-email",
  });
  assert.match(response.headers.get("set-cookie") ?? "", /ecs\.verification_email=mahi%40example\.com/);
  assert.deepEqual(requests, [
    {
      body: {
        callbackURL: "http://app.lvh.me/sign-in?verified=1&next=%2Fonboarding",
        email: "mahi@example.com",
        name: "Mahi Bekele",
        password: "password1234",
      },
      url: "http://platform.test/platform/auth/sign-up/email",
    },
    {
      body: {
        callbackURL: "http://app.lvh.me/sign-in?verified=1&next=%2Fonboarding",
        email: "mahi@example.com",
      },
      url: "http://platform.test/platform/auth/send-verification-email",
    },
  ]);
});

test("POST /sign-up/submit reports a failed initial verification delivery without losing the account", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  let call = 0;
  globalThis.fetch = async () => {
    call += 1;
    return call === 1
      ? new Response(JSON.stringify({ token: null, user: { id: "user_1" } }), { status: 200 })
      : new Response(JSON.stringify({ code: "DELIVERY_FAILED" }), { status: 503 });
  };

  const response = await POST(
    new Request("http://app.lvh.me/sign-up/submit", {
      body: JSON.stringify({
        confirmPassword: "password1234",
        email: "mahi@example.com",
        ownerName: "Mahi Bekele",
        password: "password1234",
      }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }),
  );

  assert.deepEqual(await response.json(), {
    ok: true,
    redirectTo: "http://app.lvh.me/check-email?delivery=failed",
  });
});

test("POST /sign-up/submit preserves a safe invitation continuation", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  let callbackURL: string | undefined;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    callbackURL = ((await request.json()) as { callbackURL?: string }).callbackURL;
    return new Response(JSON.stringify({ user: { id: "user_1" } }), {
      headers: {
        "content-type": "application/json",
        "set-cookie": "better-auth.session_token=session_1; HttpOnly; SameSite=Lax",
      },
      status: 200,
    });
  };

  const next = "/accept-invitation?invitationId=invitation_1";
  const response = await POST(
    new Request("http://app.lvh.me/sign-up/submit", {
      body: JSON.stringify({
        confirmPassword: "password1234",
        email: "new@example.com",
        next,
        ownerName: "New Member",
        password: "password1234",
      }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    redirectTo: `http://app.lvh.me${next}`,
  });
  assert.equal(
    callbackURL,
    "http://app.lvh.me/sign-in?verified=1&next=%2Faccept-invitation%3FinvitationId%3Dinvitation_1",
  );
});

test("POST /sign-up/submit redirects back when platform auth does not return a session cookie", async () => {
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
  body.set("confirmPassword", "password1234");

  const response = await POST(
    new Request("http://app.lvh.me/sign-up/submit", {
      body,
      method: "POST",
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "http://app.lvh.me/sign-up?error=auth_session_missing&ownerName=Mahi+Bekele&email=mahi%40example.com",
  );
});

test("POST /sign-up/submit rejects mismatched passwords before account creation", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  let requestedUpstream = false;
  globalThis.fetch = async () => {
    requestedUpstream = true;
    return new Response(null, { status: 500 });
  };

  const response = await POST(
    new Request("http://app.lvh.me/sign-up/submit", {
      body: JSON.stringify({
        confirmPassword: "different-password",
        email: "mahi@example.com",
        ownerName: "Mahi Bekele",
        password: "password1234",
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "password_mismatch", ok: false });
  assert.equal(requestedUpstream, false);
});
