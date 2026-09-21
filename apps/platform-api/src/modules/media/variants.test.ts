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
    "tenants/t/product/pending/id/w400.webp",
  );
});

test("display urls fall back to the original until variants exist", () => {
  const original = "https://media.example/photo.jpg";
  assert.equal(mediaDisplayUrls(original, {}).w400, original);
  assert.equal(
    mediaDisplayUrls(original, {
      w400: {
        byteSize: 12,
        height: 300,
        objectKey: "w400.webp",
        publicUrl: "https://media.example/w400.webp",
        width: 400,
      },
    }).w400,
    "https://media.example/w400.webp",
  );
});
