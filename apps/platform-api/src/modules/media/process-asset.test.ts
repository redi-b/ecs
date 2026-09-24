import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  MEDIA_VARIANT_CACHE_CONTROL,
  MEDIA_VARIANT_QUALITY,
  processMediaAssetImage,
} from "./process-asset.js";

test("processMediaAssetImage generates 200, 400, 800, 1200 WebP variants for 1600px image with immutable cache headers", async () => {
  // Create a synthetic 1600x1200 PNG buffer
  const sampleBuffer = await sharp({
    create: {
      width: 1600,
      height: 1200,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  }).png().toBuffer();

  const putCalls: Array<{
    body: Uint8Array;
    cacheControl?: string;
    contentType: string;
    objectKey: string;
  }> = [];

  const mockStorage = {
    getObject: async () => sampleBuffer,
    putObject: async (input: any) => {
      putCalls.push(input);
      return {
        objectKey: input.objectKey,
        publicUrl: `https://media.ourdomain.com/${input.objectKey}`,
      };
    },
  };

  const result = await processMediaAssetImage({
    mimeType: "image/png",
    objectKey: "s/shop_1/ast_1/hero.png",
    storage: mockStorage as any,
  });

  assert.equal(result.skipped, false);
  if (!result.skipped) {
    assert.ok(result.variants.w200);
    assert.ok(result.variants.w400);
    assert.ok(result.variants.w800);
    assert.ok(result.variants.w1200);
    assert.equal(result.variants.w200.width, 200);
    assert.equal(result.variants.w400.width, 400);
    assert.equal(result.variants.w800.width, 800);
    assert.equal(result.variants.w1200.width, 1200);
    assert.equal(result.variants.w200.objectKey, "s/shop_1/ast_1/hero-200w.webp");
    assert.equal(result.variants.w400.objectKey, "s/shop_1/ast_1/hero-400w.webp");
    assert.equal(result.variants.w800.objectKey, "s/shop_1/ast_1/hero-800w.webp");
    assert.equal(result.variants.w1200.objectKey, "s/shop_1/ast_1/hero-1200w.webp");
  }

  assert.equal(putCalls.length, 4);
  for (const call of putCalls) {
    assert.equal(call.cacheControl, "public, max-age=31536000, immutable");
    assert.equal(call.contentType, "image/webp");
  }
});

test("processMediaAssetImage skips upscaling for smaller images (e.g. 500px)", async () => {
  const sampleBuffer = await sharp({
    create: {
      width: 500,
      height: 400,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 1 },
    },
  }).png().toBuffer();

  const putCalls: any[] = [];
  const mockStorage = {
    getObject: async () => sampleBuffer,
    putObject: async (input: any) => {
      putCalls.push(input);
      return {
        objectKey: input.objectKey,
        publicUrl: `https://media.ourdomain.com/${input.objectKey}`,
      };
    },
  };

  const result = await processMediaAssetImage({
    mimeType: "image/png",
    objectKey: "s/shop_1/ast_2/small.png",
    storage: mockStorage as any,
  });

  assert.equal(result.skipped, false);
  if (!result.skipped) {
    assert.ok(result.variants.w200);
    assert.ok(result.variants.w400);
    assert.equal(result.variants.w800, undefined);
    assert.equal(result.variants.w1200, undefined);
    assert.equal(result.variants.w200.width, 200);
    assert.equal(result.variants.w400.width, 400);
  }
  assert.equal(putCalls.length, 2);
});

test("processMediaAssetImage skips gif or unprocessable mime types", async () => {
  const mockStorage = {
    getObject: async () => {
      throw new Error("Should not fetch object for gif");
    },
    putObject: async () => {
      throw new Error("Should not put object");
    },
  };

  const result = await processMediaAssetImage({
    mimeType: "image/gif",
    objectKey: "s/shop_1/ast_3/anim.gif",
    storage: mockStorage as any,
  });

  assert.equal(result.skipped, true);
});

test("MEDIA_VARIANT_QUALITY enforces specified WebP quality tiers", () => {
  assert.equal(MEDIA_VARIANT_QUALITY[200], 82);
  assert.equal(MEDIA_VARIANT_QUALITY[400], 80);
  assert.equal(MEDIA_VARIANT_QUALITY[800], 80);
  assert.equal(MEDIA_VARIANT_QUALITY[1200], 82);
  assert.equal(MEDIA_VARIANT_CACHE_CONTROL, "public, max-age=31536000, immutable");
});

test("processMediaAssetImage normalizes EXIF orientation and reports dimensions", async () => {
  // 600 width x 1600 height with EXIF orientation 6 (rotated 90 CW) -> effective width is 1600
  const sampleBuffer = await sharp({
    create: {
      width: 600,
      height: 1600,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const putCalls: any[] = [];
  const mockStorage = {
    getObject: async () => sampleBuffer,
    putObject: async (input: any) => {
      putCalls.push(input);
      return {
        objectKey: input.objectKey,
        publicUrl: `https://media.ourdomain.com/${input.objectKey}`,
      };
    },
  };

  const result = await processMediaAssetImage({
    mimeType: "image/jpeg",
    objectKey: "s/shop_1/ast_4/photo.jpg",
    storage: mockStorage as any,
  });

  assert.equal(result.skipped, false);
  if (!result.skipped) {
    assert.equal(result.width, 1600);
    assert.equal(result.height, 600);
    assert.ok(result.variants.w200);
    assert.ok(result.variants.w400);
    assert.ok(result.variants.w800);
    assert.ok(result.variants.w1200);
  }
  assert.equal(putCalls.length, 4);
});
