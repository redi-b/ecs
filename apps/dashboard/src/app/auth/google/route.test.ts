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

it("starts Google OAuth and forwards the shared-domain state cookie", async () => {
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("origin"), "http://app.lvh.me");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      callbackURL: "http://app.lvh.me/sign-in?next=%2Fonboarding",
      errorCallbackURL: "http://app.lvh.me/sign-in?next=%2Fonboarding&error=social_sign_in_failed",
      provider: "google",
    });
    return Response.json(
      { redirect: true, url: "https://accounts.google.com/o/oauth2/v2/auth?state=state_1" },
      { headers: { "set-cookie": "ecs.oauth_state=state_1; Path=/; HttpOnly; SameSite=Lax" } },
    );
  };

  const response = await GET(
    new Request("http://app.lvh.me/auth/google?next=%2Fonboarding", {
      headers: { host: "app.lvh.me" },
    }),
  );

  assert.equal(response.status, 303);
  assert.match(response.headers.get("location") ?? "", /^https:\/\/accounts\.google\.com\//);
  assert.match(response.headers.get("set-cookie") ?? "", /ecs\.oauth_state=state_1/);
});

it("rejects an unsafe return path", async () => {
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { callbackURL: string };
    assert.equal(body.callbackURL, "http://app.lvh.me/sign-in?next=%2Fdashboard");
    return Response.json({ redirect: true, url: "https://accounts.google.com/oauth" });
  };

  await GET(
    new Request("http://app.lvh.me/auth/google?next=https://evil.example", {
      headers: { host: "app.lvh.me" },
    }),
  );
});

it("returns to email sign-in when Google is not configured", async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  const response = await GET(
    new Request("http://app.lvh.me/auth/google", { headers: { host: "app.lvh.me" } }),
  );
  assert.equal(
    response.headers.get("location"),
    "http://app.lvh.me/sign-in?next=%2Fdashboard&error=social_sign_in_unavailable",
  );
});
