import test from "node:test";
import assert from "node:assert/strict";
import {
  generateObjectKey,
  generatePlatformObjectKey,
  variantObjectKey,
} from "../../modules/media/variants.js";

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

test("generatePlatformObjectKey routes to p/ namespace using generateObjectKey", () => {
  const key = generatePlatformObjectKey({
    assetId: "ast_789",
    filename: "logo.png",
    scope: "storefront-templates",
  });
  assert.equal(key, "p/storefront-templates/ast_789/logo.png");
});

test("generateObjectKey sanitizes filenames containing ../ path traversal", () => {
  const key1 = generateObjectKey({
    accessMode: "public",
    assetId: "ast_123",
    filename: "../../etc/sneaker.png",
    tenantId: "shop_abc",
  });
  assert.equal(key1, "s/shop_abc/ast_123/sneaker.png");

  const key2 = generateObjectKey({
    accessMode: "public",
    assetId: "ast_123",
    filename: "../sneaker.png",
    tenantId: "shop_abc",
  });
  assert.equal(key2, "s/shop_abc/ast_123/sneaker.png");
});

test("generateObjectKey sanitizes filenames containing spaces and parentheses", () => {
  const key = generateObjectKey({
    accessMode: "public",
    assetId: "ast_123",
    filename: "my sneaker (1).png",
    tenantId: "shop_abc",
  });
  assert.equal(key, "s/shop_abc/ast_123/my-sneaker-1.png");
});

test("generateObjectKey handles multi-dot filenames like my.test.photo.png", () => {
  const key = generateObjectKey({
    accessMode: "public",
    assetId: "ast_123",
    filename: "my.test.photo.png",
    tenantId: "shop_abc",
  });
  assert.equal(key, "s/shop_abc/ast_123/my.test.photo.png");
});

test("generateObjectKey handles combined path traversal, spaces, parentheses, and multi-dot filenames", () => {
  const key = generateObjectKey({
    accessMode: "public",
    assetId: "ast_123",
    filename: "../../uploads/my.test (copy 2).photo.png",
    tenantId: "shop_abc",
  });
  assert.equal(key, "s/shop_abc/ast_123/my.test-copy-2.photo.png");
});

test("variantObjectKey produces semantic slugged WebP key", () => {
  const masterKey = "s/shop_abc/ast_123/sneaker-black.png";
  assert.equal(variantObjectKey(masterKey, 200), "s/shop_abc/ast_123/sneaker-black-200w.webp");
  assert.equal(variantObjectKey(masterKey, 400), "s/shop_abc/ast_123/sneaker-black-400w.webp");
  assert.equal(variantObjectKey(masterKey, 800), "s/shop_abc/ast_123/sneaker-black-800w.webp");
  assert.equal(variantObjectKey(masterKey, 1200), "s/shop_abc/ast_123/sneaker-black-1200w.webp");
});

test("variantObjectKey robustly handles multi-dot filenames and folders with dots", () => {
  const multiDotKey = "s/shop_abc/ast_123/my.test.photo.png";
  assert.equal(
    variantObjectKey(multiDotKey, 200),
    "s/shop_abc/ast_123/my.test.photo-200w.webp",
  );

  const folderDotKey = "s/shop.v1/ast_123/avatar";
  assert.equal(
    variantObjectKey(folderDotKey, 400),
    "s/shop.v1/ast_123/avatar-400w.webp",
  );
});
