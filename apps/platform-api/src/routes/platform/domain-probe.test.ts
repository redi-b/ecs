import assert from "node:assert/strict";
import { it } from "node:test";
import { Hono } from "hono";
import type { PlatformAppVariables } from "../../app.js";
import { registerPlatformDomainProbeRoutes } from "./domain-probe.js";

it("serves only schema-checked host-bound probe identity without normal tenant admission", async () => {
  const app = new Hono<{ Variables: PlatformAppVariables }>();
  const identity = {
    version: 1 as const,
    hostname: "shop.example.com",
    tenantId: "2cbb145b-f0f1-4b1d-8d38-f0a279d61098",
    domainId: "3ff3d6e4-a77b-4fc9-aa44-2cf9966acb02",
    nonce: "a".repeat(32),
  };
  let lookups = 0;
  registerPlatformDomainProbeRoutes(app, {
    getDomainProbeIdentity: async (input) => {
      lookups++;
      assert.deepEqual(input, { hostname: identity.hostname, nonce: identity.nonce });
      return identity;
    },
  });
  const headers = { "x-forwarded-host": identity.hostname, "x-ecs-domain-probe": identity.nonce };
  const response = await app.request("/platform/storefront/domain-probe", { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), identity);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const invalid = await app.request("/platform/storefront/domain-probe", {
    headers: { ...headers, "x-ecs-domain-probe": "bad" },
  });
  assert.equal(invalid.status, 400);
  assert.equal(lookups, 1);
});
