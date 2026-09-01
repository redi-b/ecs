import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  categoryProductsHref,
  collectionProductsHref,
  resolveTaxonomySelection,
} from "./taxonomy-links.js";

describe("storefront taxonomy links", () => {
  const collection = { id: "pcol_1", title: "Gift Picks", handle: "gift-picks", mediaUrl: null };
  const category = { id: "pcat_1", name: "Skin Care", handle: "skin-care", parentCategoryId: null, mediaUrl: null };

  it("uses stable handles in customer-facing links", () => {
    assert.equal(collectionProductsHref(collection), "/products?collection=gift-picks");
    assert.equal(categoryProductsHref(category), "/products?category=skin-care");
  });

  it("resolves both canonical handles and legacy IDs", () => {
    assert.deepEqual(resolveTaxonomySelection([collection], "gift-picks"), { item: collection, legacyId: false });
    assert.deepEqual(resolveTaxonomySelection([collection], "pcol_1"), { item: collection, legacyId: true });
    assert.deepEqual(resolveTaxonomySelection([collection], "missing"), { item: null, legacyId: false });
  });
});
