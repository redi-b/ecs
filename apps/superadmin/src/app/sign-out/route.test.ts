import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("operations sign-out uses its session and leaves the merchant namespace untouched", async () => {
  const originalFetch = globalThis.fetch;
  let forwardedCookie: string | null = null;
  globalThis.fetch = async (_input, init) => {
    forwardedCookie = new Headers(init?.headers).get("cookie");
    return Response.json({ ok: true });
  };

  try {
    const response = await POST(
      new Request("http://ops.lvh.me:3002/sign-out", {
        method: "POST",
        headers: {
          cookie: "ecs.session_token=merchant; ecs-ops.session_token=operator",
        },
      }),
    );

    assert.equal(forwardedCookie, "ecs.session_token=operator");
    assert.equal(response.status, 303);
    const clears = response.headers.getSetCookie();
    assert.ok(clears.some((cookie) => cookie.startsWith("ecs-ops.session_token=")));
    assert.ok(clears.every((cookie) => !cookie.startsWith("ecs.session_token=")));
    assert.ok(clears.every((cookie) => !cookie.startsWith("better-auth.session_token=")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
