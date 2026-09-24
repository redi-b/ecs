import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { POST } from "./route.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function request(body: URLSearchParams) {
  return new Request("http://shop.lvh.me/accept-invitation/action", {
    body,
    headers: {
      cookie: "session=valid",
      host: "shop.lvh.me",
      "x-forwarded-proto": "https",
    },
    method: "POST",
  });
}

test("rejects a missing invitation without calling the auth service", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(null, { status: 204 });
  };

  const response = await POST(request(new URLSearchParams()));
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://shop.lvh.me/accept-invitation?error=invalid",
  );
  assert.equal(called, false);
});

test("accepts through Better Auth with the current session and trusted origin", async () => {
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("cookie"), "session=valid");
    assert.equal(new Headers(init?.headers).get("origin"), "https://shop.lvh.me");
    assert.deepEqual(JSON.parse(String(init?.body)), { invitationId: "invite_123" });
    return Response.json({ invitation: { id: "invite_123", status: "accepted" } });
  };

  const response = await POST(request(new URLSearchParams({ invitationId: " invite_123 " })));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://shop.lvh.me/dashboard/shops");
});

test("shows an unavailable-link error when the invitation no longer exists", async () => {
  globalThis.fetch = async () => Response.json({ code: "INVITATION_NOT_FOUND" }, { status: 404 });

  const response = await POST(request(new URLSearchParams({ invitationId: "invite/replayed" })));
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://shop.lvh.me/accept-invitation?invitationId=invite%2Freplayed&error=expired",
  );
});

test("shows an account-switch error when the signed-in email does not match", async () => {
  globalThis.fetch = async () =>
    Response.json({ code: "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION" }, { status: 403 });

  const response = await POST(request(new URLSearchParams({ invitationId: "invite_123" })));
  assert.equal(
    response.headers.get("location"),
    "https://shop.lvh.me/accept-invitation?invitationId=invite_123&error=account",
  );
});

test("shows a verification error when verified email is required", async () => {
  globalThis.fetch = async () =>
    Response.json({ code: "EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION" }, { status: 403 });

  const response = await POST(request(new URLSearchParams({ invitationId: "invite_123" })));
  assert.equal(
    response.headers.get("location"),
    "https://shop.lvh.me/accept-invitation?invitationId=invite_123&error=verify",
  );
});

test("redirects to the browser-facing host instead of an internal service URL", async () => {
  globalThis.fetch = async () => Response.json({ invitation: { status: "accepted" } });
  const invitationRequest = new Request("http://localhost:3000/accept-invitation/action", {
    body: new URLSearchParams({ invitationId: "invite_123" }),
    headers: { host: "localhost:3001" },
    method: "POST",
  });

  const response = await POST(invitationRequest);
  assert.equal(response.headers.get("location"), "http://localhost:3001/dashboard/shops");
});

test("opens the invited shop after validating the accepted membership", async () => {
  let call = 0;
  globalThis.fetch = async (input) => {
    call += 1;
    if (call === 1) {
      return Response.json({ invitation: { id: "invite_123", status: "accepted" } });
    }
    assert.match(String(input), /\/platform\/tenants\/tenant_2$/);
    return Response.json({
      tenant: {
        createdAt: "2026-09-11T00:00:00.000Z",
        handle: "second-shop",
        id: "tenant_2",
        name: "Second shop",
        primaryDomain: { hostname: "second-shop.lvh.me" },
        role: "staff",
        status: "active",
        updatedAt: "2026-09-11T00:00:00.000Z",
      },
    });
  };

  const response = await POST(
    request(new URLSearchParams({ invitationId: "invite_123", tenantId: "tenant_2" })),
  );
  assert.equal(response.headers.get("location"), "https://second-shop.lvh.me/dashboard");
  assert.match(response.headers.get("set-cookie") ?? "", /ecs_last_shop=tenant_2/);
});
