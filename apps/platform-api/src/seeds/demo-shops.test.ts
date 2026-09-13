import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEMO_OPERATIONS, demoProductImages, demoShops } from "./demo-shops.js";

describe("demo showcase fixtures", () => {
  it("keeps handles unique and relationships resolvable", () => {
    for (const shop of demoShops) {
      const categoryHandles = new Set(shop.categories.map((category) => category.handle));
      const collectionHandles = new Set(shop.collections.map((collection) => collection.handle));
      const productHandles = shop.products.map((product) => product.handle);

      assert.equal(categoryHandles.size, shop.categories.length);
      assert.equal(collectionHandles.size, shop.collections.length);
      assert.equal(new Set(productHandles).size, productHandles.length);

      for (const category of shop.categories) {
        if (category.parentHandle) assert.ok(categoryHandles.has(category.parentHandle));
      }
      for (const product of shop.products) {
        if (product.categoryHandle) assert.ok(categoryHandles.has(product.categoryHandle));
        if (product.collectionHandle) assert.ok(collectionHandles.has(product.collectionHandle));
      }
    }
  });

  it("provides multiple auditable, HTTPS product photos for every item", () => {
    for (const product of demoShops.flatMap((shop) => [...shop.products])) {
      const images = demoProductImages(product.handle);
      assert.ok(images.length >= 2, `${product.handle} is missing a gallery`);
      for (const image of images) {
        assert.match(image.url, /^https:\/\/images\.pexels\.com\/photos\//);
        assert.match(image.sourceUrl, /^https:\/\/www\.pexels\.com\/photo\/\d+\/$/);
      }
    }
  });

  it("contains enough operational depth for dashboard showcase views", () => {
    for (const shop of demoShops) {
      assert.ok(shop.products.length >= 12);
      assert.ok(shop.customers.length >= 8);
      assert.ok(shop.categories.length >= 7);
      assert.ok(shop.collections.length >= 3);
    }
  });

  it("uses branded demo identities without hyphenated emails or shop handles", () => {
    const identities = [
      ...demoShops.map((shop) => shop.user.email),
      DEMO_OPERATIONS.operator.email,
      DEMO_OPERATIONS.approver.email,
    ];
    for (const email of identities) {
      assert.doesNotMatch(email, /-/);
      assert.match(email, /@(?:[a-z0-9]+\.)*ecs\.et$/);
    }
    for (const shop of demoShops) assert.doesNotMatch(shop.tenant.handle, /-/);
  });
});
