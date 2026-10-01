import assert from "node:assert/strict";
import { it } from "node:test";
import { createTenantManagementRuntime } from "./tenant-management.js";

const domainEnv = {
  ECS_CUSTOM_DOMAINS_ENABLED: "true",
  ECS_DOMAIN_ROUTE_DIRECTORY: "/tmp/ecs-owned-test-routes",
  ECS_DOMAIN_TRAEFIK_API_URL: "http://dokploy-traefik:8080",
  ECS_DOMAIN_INGRESS_IPV4: "178.238.224.27",
  ECS_DOMAIN_STOREFRONT_SERVICE: "ecs-custom-domains-storefront@file",
};
const claim = { hostname: "shop.example.com", tenantId: "tenant_1", userId: "user_1" };

it("keeps creation disabled by default and rejects partial enabled infrastructure", async () => {
  const runtime = createTenantManagementRuntime({ db: {} as never, env: {} });
  assert.deepEqual(await runtime.domainManagementService.createTenantDomain(claim), {
    ok: false,
    error: "custom_domains_unavailable",
    status: 503,
  });
  assert.throws(
    () =>
      createTenantManagementRuntime({
        db: {} as never,
        env: { ECS_CUSTOM_DOMAINS_ENABLED: "true" },
      }),
    /incomplete/,
  );
});

it("configured creation still requires current tenant entitlement", async () => {
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    where: () => query,
    limit: async () => [],
    orderBy: async () => [],
  };
  const runtime = createTenantManagementRuntime({
    db: { select: () => query } as never,
    env: domainEnv,
  });
  assert.deepEqual(await runtime.domainManagementService.createTenantDomain(claim), {
    ok: false,
    error: "entitlement_required",
    status: 403,
  });
});
