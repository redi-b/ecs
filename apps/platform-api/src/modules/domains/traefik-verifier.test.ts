import assert from "node:assert/strict";
import { it } from "node:test";
import { createTraefikRouteVerifier } from "./traefik-verifier.js";

it("rejects stale or unavailable provider configuration within a bounded deadline", async () => {
  let calls = 0;
  const verify = createTraefikRouteVerifier({
    apiBaseUrl: "http://dokploy-traefik:8080",
    routeOptions: { service: "ecs-custom-storefront@file", resolver: "letsencrypt" },
    timeoutMs: 30,
    pollMs: 5,
    fetcher: async (url) => {
      assert.ok(url instanceof URL);
      assert.equal(url.hostname, "dokploy-traefik");
      calls++;
      return Response.json([]);
    },
  });
  await assert.rejects(verify(["shop.example.com"]), /not accepted/);
  assert.ok(calls > 0);
});

it("bounds stalled internal API requests and refuses redirects or credentials", async () => {
  const verify = createTraefikRouteVerifier({
    apiBaseUrl: "http://dokploy-traefik:8080",
    routeOptions: { service: "ecs-custom-storefront@file", resolver: "letsencrypt" },
    timeoutMs: 30,
    pollMs: 5,
    fetcher: async (_url, init) => {
      assert.equal(init?.redirect, "error");
      assert.equal(init?.credentials, "omit");
      return new Promise<Response>(() => {});
    },
  });
  await assert.rejects(verify([]), /not accepted/);
  assert.throws(
    () =>
      createTraefikRouteVerifier({
        apiBaseUrl: "http://user:secret@dokploy-traefik:8080",
        routeOptions: { service: "ecs-custom-storefront@file", resolver: "letsencrypt" },
      }),
    /internal Traefik API origin/,
  );
});
