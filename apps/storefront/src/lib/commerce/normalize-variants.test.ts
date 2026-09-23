import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProduct } from "./normalize.js";

test("normalizeProduct extracts thumbnailVariants and gallery variants deterministically without regex", () => {
  const masterHero = "https://media.ourdomain.com/s/shop_1/ast_1/hero.png";
  const masterAngle = "https://media.ourdomain.com/s/shop_1/ast_2/angle.png";

  const raw = {
    id: "prod_1",
    title: "Running Shoe",
    thumbnail: masterHero,
    images: [{ url: masterHero }, { url: masterAngle }],
    metadata: {
      media_variants: {
        [masterHero]: {
          w200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp",
          w400: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp",
          w800: "https://media.ourdomain.com/s/shop_1/ast_1/hero-800w.webp",
          w1200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-1200w.webp",
        },
        [masterAngle]: {
          w200: "https://media.ourdomain.com/s/shop_1/ast_2/angle-200w.webp",
          w400: "https://media.ourdomain.com/s/shop_1/ast_2/angle-400w.webp",
        },
      },
    },
  };

  const product = normalizeProduct(raw);
  assert.equal(product.thumbnail, masterHero);
  assert.equal(product.thumbnailVariants?.w200, "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp");
  assert.equal(product.gallery[0]?.variants?.w400, "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp");
  assert.equal(product.gallery[1]?.variants?.w200, "https://media.ourdomain.com/s/shop_1/ast_2/angle-200w.webp");
});

test("normalizeProduct gracefully falls back when metadata.media_variants is missing", () => {
  const legacyUrl = "https://media.ourdomain.com/legacy/photo.jpg";
  const raw = {
    id: "prod_2",
    title: "Legacy Shoe",
    thumbnail: legacyUrl,
    images: [{ url: legacyUrl }],
  };

  const product = normalizeProduct(raw);
  assert.equal(product.thumbnail, legacyUrl);
  assert.equal(product.thumbnailVariants, undefined);
  assert.equal(product.gallery[0]?.url, legacyUrl);
});
