import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDomainRuntimeConfig } from "./runtime-config.js";

test("domain infrastructure is optional while disabled but incomplete enablement fails closed", () => {
  assert.equal(parseDomainRuntimeConfig({}), undefined);
  assert.equal(parseDomainRuntimeConfig({ ECS_CUSTOM_DOMAINS_ENABLED: "false" }), undefined);
  assert.throws(
    () => parseDomainRuntimeConfig({ ECS_CUSTOM_DOMAINS_ENABLED: "true" }),
    /ECS_DOMAIN_ROUTE_DIRECTORY.*ECS_DOMAIN_TRAEFIK_API_URL.*ECS_DOMAIN_INGRESS_IPV4.*ECS_DOMAIN_STOREFRONT_SERVICE/,
  );
  assert.throws(
    () => parseDomainRuntimeConfig({ ECS_DOMAIN_ROUTE_DIRECTORY: "/routes" }),
    /incomplete/,
  );
  const config = parseDomainRuntimeConfig({
    ECS_CUSTOM_DOMAINS_ENABLED: "false",
    ECS_DOMAIN_ROUTE_DIRECTORY: "/routes",
    ECS_DOMAIN_TRAEFIK_API_URL: "http://dokploy-traefik:8080",
    ECS_DOMAIN_INGRESS_IPV4: "178.238.224.27",
    ECS_DOMAIN_STOREFRONT_SERVICE: "ecs-storefront@file",
    STOREFRONT_PUBLIC_BASE_DOMAIN: "ecset.dev",
  });
  assert.deepEqual(config, {
    enabled: false,
    directory: "/routes",
    apiBaseUrl: "http://dokploy-traefik:8080",
    ingressAddresses: ["178.238.224.27"],
    routeOptions: {
      service: "ecs-storefront@file",
      resolver: "letsencrypt",
      platformBaseDomain: "ecset.dev",
    },
  });
});

test("domain runtime rejects unsafe probe targets, ambiguous backends and credential-bearing API origins", () => {
  const env = {
    ECS_CUSTOM_DOMAINS_ENABLED: "true",
    ECS_DOMAIN_ROUTE_DIRECTORY: "/routes",
    ECS_DOMAIN_TRAEFIK_API_URL: "http://dokploy-traefik:8080",
    ECS_DOMAIN_INGRESS_IPV4: "178.238.224.27",
    ECS_DOMAIN_STOREFRONT_SERVICE: "ecs-storefront@file",
  };
  for (const override of [
    { ECS_DOMAIN_INGRESS_IPV4: "127.0.0.1" },
    { ECS_DOMAIN_INGRESS_IPV4: "178.238.224.27," },
    { ECS_DOMAIN_STOREFRONT_SERVICE: "storefront" },
    { ECS_DOMAIN_ROUTE_DIRECTORY: "/" },
    { ECS_DOMAIN_TRAEFIK_API_URL: "http://admin:secret@dokploy-traefik:8080" },
    { ECS_DOMAIN_TRAEFIK_API_URL: "http://dokploy-traefik:8080/api" },
    { ECS_CUSTOM_DOMAINS_ENABLED: "yes" },
  ])
    assert.throws(() => parseDomainRuntimeConfig({ ...env, ...override }));
});
