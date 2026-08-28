import assert from "node:assert/strict";
import { test } from "node:test";

import { getStorefrontBaseDomain, getStorefrontDemoHost } from "./env.js";

test("runtime configuration wins over bundled storefront host values", () => {
  const environment = {
    STOREFRONT_BASE_DOMAIN: "ecs.production.test",
    STOREFRONT_DEMO_HOST: "demo.ecs.production.test",
  };

  assert.equal(getStorefrontDemoHost("demo.lvh.me", environment), "demo.ecs.production.test");
  assert.equal(
    getStorefrontBaseDomain({ buildBaseDomain: "lvh.me", environment }),
    "ecs.production.test",
  );
});

test("blank runtime values fall back to bundled configuration", () => {
  const environment = {
    STOREFRONT_BASE_DOMAIN: " ",
    STOREFRONT_DEMO_HOST: "",
  };

  assert.equal(getStorefrontDemoHost("demo.lvh.me", environment), "demo.lvh.me");
  assert.equal(
    getStorefrontBaseDomain({
      buildPublicBaseDomain: "lvh.me",
      environment,
    }),
    "lvh.me",
  );
});

test("storefront domain resolution has a safe local default", () => {
  assert.equal(getStorefrontDemoHost(undefined, {}), undefined);
  assert.equal(getStorefrontBaseDomain({ environment: {} }), "lvh.me");
});
