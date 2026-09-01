import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { StoreProduct } from "./commerce/types.js";
import { buildProductStructuredData, serializeJsonLd } from "./structured-data.js";

const seo = {
  canonicalUrl: "https://shop.example/products/buna",
  description: "Coffee",
  imageUrl: "https://shop.example/media/buna.jpg",
  title: "Buna · Shop",
};

describe("commerce structured data", () => {
  it("emits an absolute validated offer from known product values", () => {
    const data = buildProductStructuredData({ product: product(), seo });
    assert.deepEqual(data?.offers, {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      price: 450,
      priceCurrency: "ETB",
      url: "https://shop.example/products/buna",
    });
  });

  it("omits an offer instead of inventing unknown price or currency", () => {
    const data = buildProductStructuredData({
      product: product({ currencyCode: null, priceAmount: null, variants: [] }),
      seo,
    });
    assert.equal("offers" in (data ?? {}), false);
  });

  it("emits no Product object for missing or noindex products", () => {
    assert.equal(buildProductStructuredData({ product: null, seo }), null);
    assert.equal(
      buildProductStructuredData({ product: product(), seo: { ...seo, noindex: true } }),
      null,
    );
  });

  it("escapes script-closing merchant content during serialization", () => {
    const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    assert.doesNotMatch(serialized, /<\/script>/);
    assert.match(serialized, /\\u003c\/script\\u003e/);
  });

  it("projects rich product descriptions to plain text", () => {
    const data = buildProductStructuredData({
      product: product({
        description: "<p>Built for <strong>daily work</strong>.</p><ul><li>Fast</li><li>Quiet</li></ul>",
      }),
      seo,
    });

    assert.equal(data?.description, "Built for daily work. Fast Quiet");
  });
});

function product(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: "product_1",
    title: "Buna",
    handle: "buna",
    description: "Fresh coffee",
    thumbnail: "/media/buna.jpg",
    images: [],
    variants: [
      {
        id: "variant_1",
        title: "Default",
        sku: "BUNA-1",
        manageInventory: true,
        allowBackorder: false,
        inventoryQuantity: 4,
        inStock: true,
        priceAmount: 450,
        currencyCode: "etb",
        optionValues: [],
      },
    ],
    options: [],
    collectionId: null,
    collectionTitle: null,
    categoryIds: [],
    priceAmount: 450,
    currencyCode: "ETB",
    ...overrides,
  };
}
