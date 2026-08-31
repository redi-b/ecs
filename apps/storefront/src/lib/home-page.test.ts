import assert from "node:assert/strict";
import test from "node:test";

import { getStorefrontTemplateDefinition, nexahubV1Defaults } from "@ecs/storefront-templates";
import { resolveHomeMerchandising } from "./home-page.js";

test("NexaHub resolves its home catalog contract without assuming Luvia field names", () => {
  const template = getStorefrontTemplateDefinition("nexahub@1");
  assert.ok(template);

  const merchandising = resolveHomeMerchandising(template.homeCatalog, nexahubV1Defaults);

  assert.ok(merchandising);
  assert.deepEqual(merchandising.featuredProducts.productIds, []);
  assert.equal(merchandising.featuredProducts.limit, 8);
  assert.equal(merchandising.allowUnselectedProductFallback, true);
});
