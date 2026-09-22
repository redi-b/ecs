import test from "node:test";
import assert from "node:assert/strict";
import { generateObjectKey, variantObjectKey } from "../../modules/media/variants.js";

test("generateObjectKey creates clean permanent shop key without pending/ for public assets", () => {
  const key = generateObjectKey({
    accessMode: "public",
    assetId: "ast_123",
    filename: "sneaker-black.png",
    tenantId: "shop_abc",
  });
  assert.equal(key, "s/shop_abc/ast_123/sneaker-black.png");
});

test("generateObjectKey creates private/ prefix for private assets", () => {
  const key = generateObjectKey({
    accessMode: "private",
    assetId: "ast_456",
    filename: "guide.pdf",
    tenantId: "shop_abc",
  });
  assert.equal(key, "private/s/shop_abc/ast_456/guide.pdf");
});

test("generateObjectKey creates p/ key for platform system assets", () => {
  const key = generateObjectKey({
    accessMode: "public",
    assetId: "ast_789",
    filename: "logo.png",
    scope: "storefront-templates",
  });
  assert.equal(key, "p/storefront-templates/ast_789/logo.png");
});

test("variantObjectKey produces semantic slugged WebP key", () => {
  const masterKey = "s/shop_abc/ast_123/sneaker-black.png";
  assert.equal(variantObjectKey(masterKey, 200), "s/shop_abc/ast_123/sneaker-black-200w.webp");
  assert.equal(variantObjectKey(masterKey, 400), "s/shop_abc/ast_123/sneaker-black-400w.webp");
  assert.equal(variantObjectKey(masterKey, 800), "s/shop_abc/ast_123/sneaker-black-800w.webp");
  assert.equal(variantObjectKey(masterKey, 1200), "s/shop_abc/ast_123/sneaker-black-1200w.webp");
});
