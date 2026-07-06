import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { GET } from "./route.js";

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

test("GET /admin/onboarding/handle checks shop handle availability through the Platform API", async () => {
  process.env.PLATFORM_API_BASE_URL = "http://platform.test";
  let forwardedUrl: string | undefined;

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    forwardedUrl = request.url;

    return new Response(
      JSON.stringify({
        available: true,
        handle: "addis-pantry",
        hostname: "addis-pantry.lvh.me",
      }),
      {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      },
    );
  };

  const response = await GET(
    new Request("http://dashboard.lvh.me/admin/onboarding/handle?handle=addis-pantry"),
  );

  assert.equal(response.status, 200);
  assert.equal(
    forwardedUrl,
    "http://platform.test/platform/tenants/handle-availability?handle=addis-pantry",
  );
  assert.deepEqual(await response.json(), {
    available: true,
    handle: "addis-pantry",
    hostname: "addis-pantry.lvh.me",
  });
});
