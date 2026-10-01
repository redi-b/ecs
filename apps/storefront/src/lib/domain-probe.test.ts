import assert from "node:assert/strict";
import { it } from "node:test";
import { getDomainProbeResponse } from "./domain-probe.js";

it("uses the original Host and forwards only probe context to the configured API", async () => {
  const nonce = "a".repeat(32);
  const identity = {
    version: 1,
    hostname: "shop.example.com",
    tenantId: "2cbb145b-f0f1-4b1d-8d38-f0a279d61098",
    domainId: "3ff3d6e4-a77b-4fc9-aa44-2cf9966acb02",
    nonce,
  };
  const response = await getDomainProbeResponse({
    request: new Request("https://shop.example.com/.well-known/ecs-domain-verification", {
      headers: {
        Host: identity.hostname,
        "x-forwarded-host": "attacker.example.com",
        "x-ecs-domain-probe": nonce,
        Cookie: "private=session",
        Authorization: "Bearer private",
      },
    }),
    platformApiBaseUrl: "http://platform-api:3000",
    fetcher: async (request) => {
      assert.equal(request.url, "http://platform-api:3000/platform/storefront/domain-probe");
      assert.equal(request.headers.get("x-forwarded-host"), identity.hostname);
      assert.equal(request.headers.get("x-ecs-domain-probe"), nonce);
      assert.equal(request.headers.get("cookie"), null);
      assert.equal(request.headers.get("authorization"), null);
      assert.equal(request.redirect, "error");
      return Response.json(identity, { headers: { "set-cookie": "private=leak" } });
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), identity);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("set-cookie"), null);
});

it("rejects stale or oversized API identity and exposes no upstream error details", async () => {
  const nonce = "a".repeat(32);
  const request = new Request("https://shop.example.com/.well-known/ecs-domain-verification", {
    headers: { "x-ecs-domain-probe": nonce },
  });
  const identity = {
    version: 1,
    hostname: "shop.example.com",
    tenantId: "2cbb145b-f0f1-4b1d-8d38-f0a279d61098",
    domainId: "3ff3d6e4-a77b-4fc9-aa44-2cf9966acb02",
    nonce,
  };
  for (const response of [
    Response.json({ ...identity, nonce: "b".repeat(32) }),
    Response.json(identity, { headers: { "content-type": "text/html" } }),
    new Response(" ".repeat(5000) + JSON.stringify(identity), {
      headers: { "content-type": "application/json" },
    }),
    Response.json({ error: "private database details" }, { status: 500 }),
  ]) {
    const result = await getDomainProbeResponse({
      request,
      platformApiBaseUrl: "http://platform-api:3000",
      fetcher: async () => response,
    });
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { error: "domain_probe_unavailable" });
  }
});
