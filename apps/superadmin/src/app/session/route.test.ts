import assert from "node:assert/strict";
import test from "node:test";

import { getSafeReturnTo } from "@/lib/safe-return-to";
import { POST } from "./route";

function signInRequest(form: URLSearchParams) {
  return new Request("http://ops.lvh.me:3002/session", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      host: "ops.lvh.me:3002",
    },
    body: form,
  });
}

test("operator sign-in forwards credentials and issues a separate host-only operations session", async () => {
  const originalFetch = globalThis.fetch;
  const previousDomain = process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN;
  process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN = ".lvh.me";
  let captured: { body?: string; origin?: string | null; url?: string } = {};
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/platform/operator/session")) {
      return Response.json({ principalId: "principal_1" });
    }
    captured = {
      body: String(init?.body),
      origin: new Headers(init?.headers).get("origin"),
      url: String(input),
    };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "set-cookie": "ecs.session_token=secret; HttpOnly; SameSite=Lax; Path=/",
      },
    });
  };

  try {
    const response = await POST(
      signInRequest(new URLSearchParams({ email: " Staff@Example.com ", password: "password123" })),
    );
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "http://ops.lvh.me:3002/");
    assert.match(response.headers.get("set-cookie") ?? "", /ecs-ops\.session_token=secret/);
    assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /Domain=/);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.equal(captured.url, "http://localhost:3000/platform/auth/sign-in/email");
    assert.equal(captured.origin, "http://ops.lvh.me:3002");
    assert.deepEqual(JSON.parse(captured.body ?? "{}"), {
      email: "staff@example.com",
      password: "password123",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousDomain === undefined) delete process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN;
    else process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN = previousDomain;
  }
});

test("operator sign-in rejects missing credentials without calling Platform", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response();
  };
  try {
    const response = await POST(signInRequest(new URLSearchParams({ email: "" })));
    assert.equal(response.status, 303);
    assert.match(response.headers.get("location") ?? "", /invalid_credentials/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("operator sign-in returns an in-page response for enhanced forms", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).endsWith("/platform/operator/session")
      ? Response.json({ principalId: "principal_1" })
      : new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "set-cookie": "ecs.session_token=secret; HttpOnly; SameSite=Lax; Path=/",
          },
        });

  try {
    const request = signInRequest(
      new URLSearchParams({ email: "operator@ecs.local", password: "password123" }),
    );
    request.headers.set("accept", "application/json");
    const response = await POST(request);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, returnTo: "/" });
    assert.match(response.headers.get("set-cookie") ?? "", /ecs-ops.session_token=secret/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enhanced sign-in errors stay on the current page", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "invalid_credentials" }, { status: 401 });

  try {
    const request = signInRequest(
      new URLSearchParams({ email: "operator@ecs.local", password: "not-the-password" }),
    );
    request.headers.set("accept", "application/json");
    const response = await POST(request);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "invalid_credentials" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("merchant credentials receive the same in-page invalid sign-in response", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/platform/auth/sign-in/email")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "set-cookie": "ecs.session_token=merchant; HttpOnly; SameSite=Lax; Path=/" },
      });
    }
    if (url.endsWith("/platform/operator/session")) {
      return Response.json({ error: "operator_forbidden" }, { status: 403 });
    }
    return Response.json({ success: true });
  };

  try {
    const request = signInRequest(
      new URLSearchParams({ email: "merchant@example.com", password: "password123" }),
    );
    request.headers.set("accept", "application/json");
    const response = await POST(request);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "invalid_credentials" });
    assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(calls, [
      "http://localhost:3000/platform/auth/sign-in/email",
      "http://localhost:3000/platform/operator/session",
      "http://localhost:3000/platform/auth/sign-out",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("operator reauthentication derives the current email from the session and returns safely", async () => {
  const originalFetch = globalThis.fetch;
  const previousDomain = process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN;
  process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN = ".lvh.me";
  const calls: Array<{ body?: string; cookie?: string | null; url: string }> = [];
  globalThis.fetch = async (input, init) => {
    const call = {
      body: init?.body ? String(init.body) : undefined,
      cookie: new Headers(init?.headers).get("cookie"),
      url: String(input),
    };
    calls.push(call);
    if (call.url.endsWith("/platform/me")) {
      return Response.json({ user: { email: "current.operator@ecs.local" } });
    }
    if (call.url.endsWith("/platform/operator/session")) {
      return Response.json({ principalId: "principal_1" });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "set-cookie": "ecs.session_token=fresh; HttpOnly; SameSite=Lax; Path=/" },
    });
  };

  try {
    const request = signInRequest(
      new URLSearchParams({
        email: "ignored@ecs.local",
        intent: "reauthenticate",
        password: "password123",
        returnTo: "/tenants/tenant_1?tab=billing",
      }),
    );
    request.headers.set("cookie", "ecs.session_token=merchant; ecs-ops.session_token=existing");
    const response = await POST(request);

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "http://ops.lvh.me:3002/tenants/tenant_1?tab=billing",
    );
    assert.equal(calls[0]?.cookie, "ecs.session_token=existing");
    assert.deepEqual(JSON.parse(calls[1]?.body ?? "{}"), {
      email: "current.operator@ecs.local",
      password: "password123",
    });
    assert.match(response.headers.get("set-cookie") ?? "", /fresh/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousDomain === undefined) delete process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN;
    else process.env.SUPERADMIN_AUTH_COOKIE_DOMAIN = previousDomain;
  }
});

test("operator reauthentication rejects an expired session before checking a password", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ error: "auth_required" }, { status: 401 });
  };
  try {
    const response = await POST(
      signInRequest(
        new URLSearchParams({
          intent: "reauthenticate",
          password: "password123",
          returnTo: "/tenants/tenant_1",
        }),
      ),
    );
    assert.equal(response.status, 303);
    assert.match(response.headers.get("location") ?? "", /sign-in\?error=session_expired/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enhanced reauthentication reports an expired session without following a redirect", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "auth_required" }, { status: 401 });
  try {
    const request = signInRequest(
      new URLSearchParams({
        intent: "reauthenticate",
        password: "password123",
        returnTo: "/tenants/tenant_1",
      }),
    );
    request.headers.set("accept", "application/json");
    const response = await POST(request);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "session_expired" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("safe return paths cannot leave the operations origin", () => {
  const requestUrl = "http://ops.lvh.me:3002/session";
  assert.equal(
    getSafeReturnTo("/tenants/tenant_1?tab=billing", requestUrl),
    "/tenants/tenant_1?tab=billing",
  );
  assert.equal(getSafeReturnTo("https://attacker.example", requestUrl), "/");
  assert.equal(getSafeReturnTo("//attacker.example", requestUrl), "/");
  assert.equal(getSafeReturnTo("/\\attacker.example", requestUrl), "/");
});
