import assert from "node:assert/strict";
import test from "node:test";

import {
  getStorefrontTemplateDefinition,
  luviaV1Defaults,
  nexahubV1Defaults,
} from "@ecs/storefront-templates";
import { resolveHomeMerchandising, resolveHomeProductIds } from "./home-page.js";

test("NexaHub resolves its home catalog contract without assuming Luvia field names", () => {
  const template = getStorefrontTemplateDefinition("nexahub@1");
  assert.ok(template);

  const merchandising = resolveHomeMerchandising(template.homeCatalog, nexahubV1Defaults);

  assert.ok(merchandising);
  assert.deepEqual(merchandising.featuredProducts.productIds, []);
  assert.equal(merchandising.featuredProducts.limit, 8);
  assert.equal(merchandising.allowUnselectedProductFallback, true);
});

test("home loading includes product selections from every rendered section", () => {
  const template = getStorefrontTemplateDefinition("luvia@1");
  assert.ok(template);
  const data = structuredClone(luviaV1Defaults);
  data.home.hero.featuredProductIds = ["prod_hero"];
  data.home.featuredProducts.productIds = ["prod_featured"];
  data.home.products.productIds = ["prod_listing"];

  const merchandising = resolveHomeMerchandising(template.homeCatalog, data);
  assert.ok(merchandising);
  assert.deepEqual(resolveHomeProductIds(merchandising), [
    "prod_hero",
    "prod_featured",
    "prod_listing",
  ]);
});
