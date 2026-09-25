import assert from "node:assert/strict";
import { afterEach, it } from "node:test";

import { getSocialAuthProviders } from "./social-auth-providers.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it("uses the Platform API as the source of truth for Google availability", async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "http://platform-api:3000/platform/auth/providers");
    assert.equal(init?.cache, "no-store");
    return Response.json({ google: true });
  };

  assert.deepEqual(await getSocialAuthProviders("http://platform-api:3000/"), { google: true });
});

it("keeps Google hidden when provider discovery fails", async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 });
  assert.deepEqual(await getSocialAuthProviders("http://platform-api:3000"), { google: false });
});
