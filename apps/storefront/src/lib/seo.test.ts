import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildStorefrontSeo } from "./seo.js";

describe("storefront SEO model", () => {
  it("builds canonical and social values from the trusted public origin", () => {
    assert.deepEqual(
      buildStorefrontSeo({
        description: "  Fresh Ethiopian coffee. ",
        imageUrl: "/media/coffee.jpg",
        path: "/products/buna",
        publicOrigin: "https://shop.example.com",
        tenantName: "Buna House",
        title: "Buna",
      }),
      {
        canonicalUrl: "https://shop.example.com/products/buna",
        description: "Fresh Ethiopian coffee.",
        imageUrl: "https://shop.example.com/media/coffee.jpg",
        title: "Buna · Buna House",
      },
    );
  });

  it("can mark non-public route states as noindex", () => {
    assert.equal(
      buildStorefrontSeo({
        noindex: true,
        path: "/preview",
        publicOrigin: "https://shop.example.com",
        tenantName: "Buna House",
      }).noindex,
      true,
    );
  });
});
