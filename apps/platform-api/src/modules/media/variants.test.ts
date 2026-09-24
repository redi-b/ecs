import assert from "node:assert/strict";
import test from "node:test";

import {
  mediaDisplayUrls,
  shouldSkipImageProcessing,
  variantObjectKey,
} from "./variants.js";

test("skips gifs and multi-page images", () => {
  assert.equal(shouldSkipImageProcessing({ mimeType: "image/gif" }), true);
  assert.equal(shouldSkipImageProcessing({ mimeType: "image/jpeg", pageCount: 3 }), true);
  assert.equal(shouldSkipImageProcessing({ mimeType: "image/jpeg" }), false);
});

test("writes webp variants next to the original object", () => {
  assert.equal(
    variantObjectKey("tenants/t/product/pending/id/photo.jpg", 400),
    "tenants/t/product/pending/id/photo-400w.webp",
  );
});

test("display urls fall back to the original until variants exist", () => {
  const original = "https://media.example/photo.jpg";
  const emptyUrls = mediaDisplayUrls(original, {});
  assert.equal(emptyUrls.original, original);
  assert.equal(emptyUrls.w200, original);
  assert.equal(emptyUrls.w400, original);
  assert.equal(emptyUrls.w800, original);
  assert.equal(emptyUrls.w1200, original);
  assert.equal(emptyUrls.w96, original);

  const populatedUrls = mediaDisplayUrls(original, {
    w200: {
      byteSize: 10,
      height: 150,
      objectKey: "w200.webp",
      publicUrl: "https://media.example/w200.webp",
      width: 200,
    },
    w400: {
      byteSize: 12,
      height: 300,
      objectKey: "w400.webp",
      publicUrl: "https://media.example/w400.webp",
      width: 400,
    },
  });
  assert.equal(populatedUrls.w200, "https://media.example/w200.webp");
  assert.equal(populatedUrls.w400, "https://media.example/w400.webp");
  assert.equal(populatedUrls.w96, "https://media.example/w200.webp");
  assert.equal(populatedUrls.w800, original);
});
