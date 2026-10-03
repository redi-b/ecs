import assert from "node:assert/strict";
import test from "node:test";

import { selectableStorefrontTemplates } from "@ecs/storefront-templates";

import {
  getSelectableStorefrontDemoSlugs,
  isStorefrontDemoPath,
  resolveBrandedStorefrontDemoPath,
  resolveCookieStorefrontDemoPath,
} from "./demo-routes";

test("storefront demo routes have an explicit middleware bypass", () => {
  assert.equal(isStorefrontDemoPath("/demo"), true);
  assert.equal(isStorefrontDemoPath("/demo/storefront/luvia"), true);
  assert.equal(isStorefrontDemoPath("/demo-store"), false);
  assert.equal(isStorefrontDemoPath("/products"), false);
});

test("the configured demo host maps a selectable template journey", () => {
  const input = { demoHost: "demo.ecs.et", hostname: "demo.ecs.et" };
  assert.equal(
    resolveBrandedStorefrontDemoPath({ ...input, pathname: "/luvia" }),
    "/demo/storefront/luvia",
  );
  assert.equal(
    resolveBrandedStorefrontDemoPath({ ...input, pathname: "/luvia/products/radiance-serum" }),
    "/demo/storefront/luvia/products/radiance-serum",
  );
  assert.equal(resolveBrandedStorefrontDemoPath({ ...input, pathname: "/products" }), null);
  assert.equal(
    resolveBrandedStorefrontDemoPath({
      demoHost: "demo.ecs.et",
      hostname: "merchant.ecs.et",
      pathname: "/luvia",
    }),
    null,
  );
});

test("every selectable template automatically receives a branded demo slug", () => {
  assert.deepEqual(
    getSelectableStorefrontDemoSlugs(),
    selectableStorefrontTemplates.map((template) => template.slug),
  );

  for (const template of selectableStorefrontTemplates) {
    assert.equal(
      resolveBrandedStorefrontDemoPath({
        demoHost: "demo.ecs.et",
        hostname: "demo.ecs.et",
        pathname: `/${template.slug}/checkout`,
      }),
      `/demo/storefront/${template.slug}/checkout`,
    );
  }
});

test("unknown, unreleased, malformed, and merchant-host demo paths are rejected", () => {
  const base = { demoHost: "demo.ecs.et", hostname: "demo.ecs.et" };
  for (const pathname of ["/template-2", "/unknown/products", "//luvia", "/%E0%A4%A"]) {
    assert.equal(resolveBrandedStorefrontDemoPath({ ...base, pathname }), null);
  }
  assert.equal(
    resolveBrandedStorefrontDemoPath({
      demoHost: "demo.ecs.et",
      hostname: "bole-style.ecs.et",
      pathname: "/luvia",
    }),
    null,
  );
});

test("a demo template cookie keeps ordinary navigation inside the selected template", () => {
  const base = { demoHost: "demo.ecs.et", hostname: "demo.ecs.et", templateSlug: "nexahub" };
  assert.equal(
    resolveCookieStorefrontDemoPath({ ...base, pathname: "/products" }),
    "/nexahub/products",
  );
  assert.equal(
    resolveCookieStorefrontDemoPath({ ...base, pathname: "/contact" }),
    "/nexahub/contact",
  );
  assert.equal(resolveCookieStorefrontDemoPath({ ...base, pathname: "/" }), "/nexahub");
  assert.equal(
    resolveCookieStorefrontDemoPath({ ...base, pathname: "/demo/storefront/nexahub/products" }),
    null,
  );
  assert.equal(
    resolveCookieStorefrontDemoPath({ ...base, templateSlug: "unknown", pathname: "/products" }),
    null,
  );
});
