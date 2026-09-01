import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { StoreProduct } from "./commerce/types.js";
import {
  buildTenantRobots,
  buildTenantSitemap,
  isPrivateStorefrontPath,
  loadSitemapProductHandles,
} from "./seo-routes.js";

describe("tenant SEO routes", () => {
  it("points robots at the tenant origin and blocks private route families", () => {
    const robots = buildTenantRobots("https://shop-a.example");
    assert.match(robots, /Disallow: \/checkout/);
    assert.match(robots, /Disallow: \/preview/);
    assert.match(robots, /Sitemap: https:\/\/shop-a\.example\/sitemap\.xml/);
    assert.doesNotMatch(robots, /shop-b/);
  });

  it("classifies private HTML and action routes without overmatching public paths", () => {
    assert.equal(isPrivateStorefrontPath("/checkout/payment-return"), true);
    assert.equal(isPrivateStorefrontPath("/account/orders/order_1"), true);
    assert.equal(isPrivateStorefrontPath("/actions/cart/add"), true);
    assert.equal(isPrivateStorefrontPath("/products/accounting-book"), false);
    assert.equal(isPrivateStorefrontPath("/contact"), false);
  });

  it("paginates and deduplicates products before building a tenant-only sitemap", async () => {
    const offsets: number[] = [];
    const result = await loadSitemapProductHandles(async ({ limit, offset }) => {
      offsets.push(offset);
      const products =
        offset === 0
          ? Array.from({ length: limit }, (_, index) => product(`p_${index}`, `item-${index}`))
          : [product("p_50", "item-50"), product("p_100", "item & special")];
      return { products, count: 102, limit, offset };
    });
    assert.deepEqual(offsets, [0, 100]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.handles.length, 101);
    const sitemap = buildTenantSitemap("https://shop-a.example", result.handles);
    assert.match(sitemap, /https:\/\/shop-a\.example\/products\/item%20%26%20special/);
    assert.doesNotMatch(sitemap, /shop-b/);
  });

  it("includes canonical handle-based taxonomy URLs", () => {
    const sitemap = buildTenantSitemap("https://shop-a.example", [], {
      collectionHandles: ["gift picks"],
      categoryHandles: ["skin-care"],
    });
    assert.match(sitemap, /products\?collection=gift%20picks/);
    assert.match(sitemap, /products\?category=skin-care/);
    assert.doesNotMatch(sitemap, /pcol_|pcat_/);
  });

  it("fails without returning partial handles when a later source page fails", async () => {
    const result = await loadSitemapProductHandles(async ({ limit, offset }) =>
      offset === 0
        ? {
            products: Array.from({ length: limit }, (_, index) =>
              product(`p_${index}`, `i-${index}`),
            ),
            count: 101,
            limit,
            offset,
          }
        : { ok: false, status: 503, message: "Catalog unavailable." },
    );
    assert.deepEqual(result, { ok: false, status: 503, message: "Catalog unavailable." });
  });
});

function product(id: string, handle: string): StoreProduct {
  return {
    id,
    handle,
    title: handle,
    description: null,
    thumbnail: null,
    images: [],
    collectionId: null,
    collectionTitle: null,
    categoryIds: [],
    priceAmount: null,
    originalPriceAmount: null,
    discountPercentage: null,
    currencyCode: "ETB",
    variants: [],
    options: [],
  };
}
