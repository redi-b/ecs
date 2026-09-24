import assert from "node:assert/strict";
import { afterEach, beforeEach, it } from "node:test";
import { GET } from "./route.js";

const originalFetch = globalThis.fetch;
const originalClientId = process.env.GOOGLE_CLIENT_ID;

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "google-client-id";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = originalClientId;
});

it("starts explicit Google linking with the current session", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "http://localhost:3000/platform/auth/link-social");
    assert.equal(new Headers(init?.headers).get("cookie"), "ecs.session_token=session_1");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      callbackURL: "http://app.lvh.me/dashboard/settings?section=account&connection=google-linked",
      provider: "google",
    });
    return Response.json(
      { url: "https://accounts.google.com/o/oauth2/v2/auth?state=link_1" },
      { headers: { "set-cookie": "ecs.oauth_state=link_1; Path=/; HttpOnly" } },
    );
  };
  const response = await GET(
    new Request("http://app.lvh.me/auth/google/link", {
      headers: { cookie: "ecs.session_token=session_1", host: "app.lvh.me" },
    }),
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location")?.startsWith("https://accounts.google.com/"), true);
  assert.match(response.headers.get("set-cookie") ?? "", /ecs.oauth_state=link_1/);
});

it("returns to account settings when Google linking is unavailable", async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  const response = await GET(
    new Request("http://app.lvh.me/auth/google/link", { headers: { host: "app.lvh.me" } }),
  );
  assert.equal(
    response.headers.get("location"),
    "http://app.lvh.me/dashboard/settings?section=account&connection=google-unavailable",
  );
});
