import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProductImageSrcset,
  buildStorefrontMediaSrcset,
  normalizeStorefrontMediaUrl,
  resolveProductImage,
  resolveStorefrontMediaVariantUrl,
} from "./media-url.js";

describe("storefront media URL boundary", () => {
  const base = "https://media.example.com/ecs-media";

  it("accepts same-storefront paths and owned media objects", () => {
    assert.equal(normalizeStorefrontMediaUrl("/images/logo.svg", base), "/images/logo.svg");
    assert.equal(
      normalizeStorefrontMediaUrl("https://media.example.com/ecs-media/tenants/t1/a.jpg", base),
      "https://media.example.com/ecs-media/tenants/t1/a.jpg",
    );
  });

  it("rejects sibling paths, lookalike hosts, credentials, and non-HTTP schemes", () => {
    assert.equal(
      normalizeStorefrontMediaUrl("https://media.example.com/private/a.jpg", base),
      null,
    );
    assert.equal(
      normalizeStorefrontMediaUrl("https://media.example.com.evil.test/ecs-media/a.jpg", base),
      null,
    );
    assert.equal(normalizeStorefrontMediaUrl("javascript:alert(1)", base), null);
    assert.equal(normalizeStorefrontMediaUrl("//evil.test/a.jpg", base), null);
  });

  it("fails closed for absolute media when the trusted base is absent or invalid", () => {
    assert.equal(normalizeStorefrontMediaUrl("https://media.example.com/a.jpg", undefined), null);
    assert.equal(normalizeStorefrontMediaUrl("https://media.example.com/a.jpg", "not-a-url"), null);
  });

  it("accepts the local ECS media origin during development without weakening production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      assert.equal(
        normalizeStorefrontMediaUrl("http://localhost:9002/ecs-media/tenants/t1/product/image.jpg"),
        "http://localhost:9002/ecs-media/tenants/t1/product/image.jpg",
      );
      assert.equal(normalizeStorefrontMediaUrl("https://example.com/image.jpg"), null);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  it("resolves product image variants deterministically with fallback", () => {
    const variants = {
      w200: "https://media.example.com/ast/photo-200w.webp",
      w400: "https://media.example.com/ast/photo-400w.webp",
    };
    const fallback = "https://media.example.com/ast/photo.jpg";

    assert.equal(
      resolveProductImage(variants, "w400", fallback),
      "https://media.example.com/ast/photo-400w.webp",
    );
    assert.equal(
      resolveProductImage(variants, "w200", fallback),
      "https://media.example.com/ast/photo-200w.webp",
    );
    assert.equal(resolveProductImage(variants, "w800", fallback), fallback);
    assert.equal(resolveProductImage(undefined, "w400", fallback), fallback);
    assert.equal(resolveProductImage(undefined, "w400", null), null);
  });

  it("builds srcset from known image variants", () => {
    const variants = {
      w200: "https://media.example.com/ast/photo-200w.webp",
      w400: "https://media.example.com/ast/photo-400w.webp",
      w800: "https://media.example.com/ast/photo-800w.webp",
      w1200: "https://media.example.com/ast/photo-1200w.webp",
    };
    assert.equal(
      buildProductImageSrcset(variants),
      "https://media.example.com/ast/photo-200w.webp 200w, https://media.example.com/ast/photo-400w.webp 400w, https://media.example.com/ast/photo-800w.webp 800w, https://media.example.com/ast/photo-1200w.webp 1200w",
    );
    assert.equal(buildProductImageSrcset(undefined), null);
    assert.equal(buildProductImageSrcset({}), null);
  });

  it("falls back to master media URL without regex guessing (zero 404 guarantee)", () => {
    const original = "https://media.example.com/ecs-media/tenants/t1/product/pending/p1/photo.jpg";
    assert.equal(
      resolveStorefrontMediaVariantUrl(original, 400, base),
      original,
    );
    assert.equal(
      buildStorefrontMediaSrcset(original, [400, 800, 1200], base),
      null,
    );
  });
});

