import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getEcsLandingPageUrl,
  getStorefrontBaseDomain,
  getStorefrontDemoHost,
} from "./env.js";

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

test("uses the configured ECS landing page URL", () => {
  assert.equal(
    getEcsLandingPageUrl({
      ECS_LANDING_PAGE_URL: " https://ecs.example.et ",
      NODE_ENV: "production",
    }),
    "https://ecs.example.et",
  );
});

test("uses the local ECS domain outside production", () => {
  assert.equal(getEcsLandingPageUrl({ NODE_ENV: "development" }), "http://ecs.lvh.me");
});

test("requires an explicit ECS landing page URL in production", () => {
  assert.throws(
    () => getEcsLandingPageUrl({ NODE_ENV: "production" }),
    /ECS_LANDING_PAGE_URL is required in production/,
  );
});
