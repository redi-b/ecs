import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldBackfillProductImage,
  parseBackfillArgs,
  extractProductImages,
  getObjectKeyFromUrl,
  parseImageKeys,
  runBackfill,
  type MedusaProductForBackfill,
} from "./media-backfill.js";

test("shouldBackfillProductImage returns false if variants already exist", () => {
  const url = "https://media.ourdomain.com/s/shop_1/ast_1/hero.png";
  const metadata = {
    media_variants: {
      [url]: { w200: "...", w400: "...", w800: "...", w1200: "..." },
    },
  };
  assert.equal(shouldBackfillProductImage(url, metadata), false);
});

test("shouldBackfillProductImage returns true if variants are missing", () => {
  const url = "https://media.ourdomain.com/s/shop_1/ast_1/hero.png";
  assert.equal(shouldBackfillProductImage(url, {}), true);
  assert.equal(shouldBackfillProductImage(url, undefined), true);
});

test("shouldBackfillProductImage returns true if only partial variants exist", () => {
  const url = "https://media.ourdomain.com/s/shop_1/ast_1/hero.png";
  const metadata = {
    media_variants: {
      [url]: { w200: "...", w400: "..." }, // missing w800, w1200
    },
  };
  assert.equal(shouldBackfillProductImage(url, metadata), true);
});

test("shouldBackfillProductImage returns false if url is empty or invalid", () => {
  assert.equal(shouldBackfillProductImage("", {}), false);
  assert.equal(shouldBackfillProductImage(null, {}), false);
  assert.equal(shouldBackfillProductImage(undefined, {}), false);
});

test("parseBackfillArgs parses CLI flags correctly", () => {
  const args = ["--dry-run", "--tenant", "tenant_123", "--limit", "50", "--concurrency", "8"];
  const parsed = parseBackfillArgs(args);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.tenantId, "tenant_123");
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.concurrency, 8);
});

test("parseBackfillArgs uses sensible defaults", () => {
  const parsed = parseBackfillArgs([]);
  assert.equal(parsed.dryRun, false);
  assert.equal(parsed.tenantId, undefined);
  assert.equal(parsed.limit, undefined);
  assert.equal(parsed.concurrency, 5);
});

test("extractProductImages extracts unique valid thumbnail and image URLs", () => {
  const product = {
    thumbnail: "https://media.ourdomain.com/s/shop_1/ast_1/hero.png",
    images: [
      { url: "https://media.ourdomain.com/s/shop_1/ast_1/hero.png" }, // duplicate of thumbnail
      { url: "https://media.ourdomain.com/s/shop_1/ast_2/detail.png" },
      { url: "  " },
    ],
  };
  const urls = extractProductImages(product);
  assert.deepEqual(urls, [
    "https://media.ourdomain.com/s/shop_1/ast_1/hero.png",
    "https://media.ourdomain.com/s/shop_1/ast_2/detail.png",
  ]);
});

test("getObjectKeyFromUrl extracts key from standard path or builds fallback key", () => {
  const standardKey = getObjectKeyFromUrl(
    "https://media.ourdomain.com/s/shop_1/ast_1/hero.png",
    "shop_1",
  );
  assert.equal(standardKey, "s/shop_1/ast_1/hero.png");

  const externalKey = getObjectKeyFromUrl("https://external.cdn/photos/watch.jpg", "shop_1");
  assert.match(externalKey, /^s\/shop_1\/backfill\/[a-f0-9]+\/watch\.jpg$/);
});

test("runBackfill in dry-run mode identifies missing variants without modifying data", async () => {
  const heroUrl = "https://media.ourdomain.com/s/shop_1/ast_1/hero.png";
  const products: MedusaProductForBackfill[] = [
    {
      id: "prod_1",
      title: "Watch",
      thumbnail: heroUrl,
      images: [{ url: heroUrl }],
      metadata: {},
    },
  ];

  let putObjectCalled = false;
  let updateVariantsCalled = false;

  const summary = await runBackfill({
    options: { dryRun: true, concurrency: 5 },
    dependencies: {
      storage: {
        bucket: "test-bucket",
        provider: "s3",
        checkHealth: async () => {},
        createUpload: async () => ({} as any),
        deleteObject: async () => {},
        getObject: async () => Buffer.from("mock-image"),
        getObjectMetadata: async () => ({ byteSize: 100, contentType: "image/png" }),
        putObject: async () => {
          putObjectCalled = true;
          return { publicUrl: "https://mock" };
        },
      },
      listProducts: async () => ({ count: 1, products }),
      updateProductMediaVariants: async () => {
        updateVariantsCalled = true;
      },
    },
  });

  assert.equal(summary.productsScanned, 1);
  assert.equal(summary.imagesScanned, 1);
  assert.equal(summary.imagesBackfilled, 1); // 1 identified for backfill
  assert.equal(summary.imagesSkipped, 0);
  assert.equal(putObjectCalled, false);
  assert.equal(updateVariantsCalled, false);
});

test("runBackfill skips images that already have all 4 variants", async () => {
  const heroUrl = "https://media.ourdomain.com/s/shop_1/ast_1/hero.png";
  const products: MedusaProductForBackfill[] = [
    {
      id: "prod_1",
      title: "Watch",
      thumbnail: heroUrl,
      metadata: {
        media_variants: {
          [heroUrl]: {
            w200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp",
            w400: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp",
            w800: "https://media.ourdomain.com/s/shop_1/ast_1/hero-800w.webp",
            w1200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-1200w.webp",
          },
        },
      },
    },
  ];

  let updateVariantsCalled = false;

  const summary = await runBackfill({
    options: { dryRun: false, concurrency: 5 },
    dependencies: {
      storage: {
        bucket: "test-bucket",
        provider: "s3",
        checkHealth: async () => {},
        createUpload: async () => ({} as any),
        deleteObject: async () => {},
        getObject: async () => Buffer.from("mock-image"),
        getObjectMetadata: async () => ({ byteSize: 100, contentType: "image/png" }),
        putObject: async () => ({ publicUrl: "https://mock" }),
      },
      listProducts: async () => ({ count: 1, products }),
      updateProductMediaVariants: async () => {
        updateVariantsCalled = true;
      },
    },
  });

  assert.equal(summary.productsScanned, 1);
  assert.equal(summary.imagesScanned, 1);
  assert.equal(summary.imagesSkipped, 1);
  assert.equal(summary.imagesBackfilled, 0);
  assert.equal(updateVariantsCalled, false);
});

test("runBackfill processes images, uploads WebP variants, and updates Medusa metadata", async () => {
  const sharp = (await import("sharp")).default;
  const imageBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const heroUrl = "https://media.ourdomain.com/s/shop_1/ast_1/hero.png";
  const products: MedusaProductForBackfill[] = [
    {
      id: "prod_1",
      title: "Watch",
      thumbnail: heroUrl,
      metadata: {},
      tenantId: "shop_1",
    },
  ];

  const putCalls: Array<{ body: Uint8Array; cacheControl?: string; objectKey: string }> = [];
  let updatedVariantsPayload: any = null;

  const summary = await runBackfill({
    options: { dryRun: false, concurrency: 5 },
    dependencies: {
      storage: {
        bucket: "test-bucket",
        provider: "s3",
        checkHealth: async () => {},
        createUpload: async () => ({} as any),
        deleteObject: async () => {},
        getObject: async () => imageBuffer,
        getObjectMetadata: async () => ({ byteSize: imageBuffer.length, contentType: "image/png" }),
        putObject: async (input) => {
          putCalls.push(input as any);
          return { publicUrl: `https://media.ourdomain.com/${input.objectKey}` };
        },
      },
      listProducts: async () => ({ count: 1, products }),
      updateProductMediaVariants: async (input) => {
        updatedVariantsPayload = input;
      },
    },
  });

  assert.equal(summary.productsScanned, 1);
  assert.equal(summary.productsUpdated, 1);
  assert.equal(summary.imagesScanned, 1);
  assert.equal(summary.imagesBackfilled, 1);
  assert.equal(summary.imagesSkipped, 0);
  assert.equal(summary.imagesFailed, 0);

  assert.equal(putCalls.length, 4);
  assert.ok(putCalls.every((call) => call.cacheControl === "public, max-age=31536000, immutable"));
  const keys = putCalls.map((c) => c.objectKey);
  assert.ok(keys.includes("s/shop_1/ast_1/hero-200w.webp"));
  assert.ok(keys.includes("s/shop_1/ast_1/hero-400w.webp"));
  assert.ok(keys.includes("s/shop_1/ast_1/hero-800w.webp"));
  assert.ok(keys.includes("s/shop_1/ast_1/hero-1200w.webp"));

  assert.deepEqual(updatedVariantsPayload, {
    productId: "prod_1",
    tenantId: "shop_1",
    mediaVariants: {
      [heroUrl]: {
        w200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp",
        w400: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp",
        w800: "https://media.ourdomain.com/s/shop_1/ast_1/hero-800w.webp",
        w1200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-1200w.webp",
      },
    },
  });
});

test("parseImageKeys correctly maps legacy tenant paths to canonical keys", () => {
  const legacyProductUrl =
    "https://media.domain.com/ecs-media/tenants/shop_123/product/ast_456/cover.jpg";
  const parsed1 = parseImageKeys(legacyProductUrl, "shop_123", "ecs-media");
  assert.equal(parsed1.canonicalKey, "s/shop_123/ast_456/cover.jpg");
  assert.equal(parsed1.originalStorageKey, "tenants/shop_123/product/ast_456/cover.jpg");

  const legacySimpleUrl =
    "https://media.domain.com/ecs-media/tenants/shop_123/ast_456/photo.png";
  const parsed2 = parseImageKeys(legacySimpleUrl, "shop_123", "ecs-media");
  assert.equal(parsed2.canonicalKey, "s/shop_123/ast_456/photo.png");
  assert.equal(parsed2.originalStorageKey, "tenants/shop_123/ast_456/photo.png");

  const flawedBackfillUrl =
    "https://media.domain.com/ecs-media/p/backfill/hash123/watch.jpg";
  const parsed3 = parseImageKeys(flawedBackfillUrl, "shop_123", "ecs-media");
  assert.equal(parsed3.canonicalKey, "s/shop_123/hash123/watch.jpg");
  assert.equal(parsed3.originalStorageKey, "p/backfill/hash123/watch.jpg");
});

test("shouldBackfillProductImage always returns true for legacy /tenants/ and /p/backfill/ URLs", () => {
  const legacyUrl = "https://media.domain.com/ecs-media/tenants/shop_1/product/ast_1/cover.jpg";
  const metadataWithVariants = {
    media_variants: {
      [legacyUrl]: { w200: "...", w400: "...", w800: "...", w1200: "..." },
    },
  };
  assert.equal(shouldBackfillProductImage(legacyUrl, metadataWithVariants), true);

  const backfillUrl = "https://media.domain.com/ecs-media/p/backfill/hash/cover.jpg";
  assert.equal(shouldBackfillProductImage(backfillUrl, metadataWithVariants), true);
});

test("runBackfill migrates legacy tenant image to canonical s/ path and updates product thumbnail and images", async () => {
  const sharp = (await import("sharp")).default;
  const imageBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const legacyUrl =
    "https://media.ourdomain.com/ecs-media/tenants/shop_1/product/ast_legacy/cover.jpg";
  const products: MedusaProductForBackfill[] = [
    {
      id: "prod_legacy",
      images: [{ url: legacyUrl }],
      metadata: { platform_tenant_id: "shop_1" },
      tenantId: "shop_1",
      thumbnail: legacyUrl,
      title: "Legacy Product",
    },
  ];

  const putCalls: Array<{ body: Uint8Array; cacheControl?: string; objectKey: string }> = [];
  let updatedPayload: any = null;

  const storageMap = new Map<string, Buffer>();
  storageMap.set("tenants/shop_1/product/ast_legacy/cover.jpg", imageBuffer);

  const summary = await runBackfill({
    options: { dryRun: false, concurrency: 1 },
    dependencies: {
      publicBaseUrl: "https://media.ourdomain.com/ecs-media",
      storage: {
        bucket: "ecs-media",
        provider: "s3",
        checkHealth: async () => {},
        createUpload: async () => ({} as any),
        deleteObject: async () => {},
        getObject: async (key: string) => {
          const buf = storageMap.get(key);
          if (!buf) throw new Error("Not found");
          return buf;
        },
        getObjectMetadata: async () => ({ byteSize: imageBuffer.length, contentType: "image/png" }),
        putObject: async (input) => {
          putCalls.push(input as any);
          storageMap.set(input.objectKey, Buffer.from(input.body));
          return { publicUrl: `https://media.ourdomain.com/ecs-media/${input.objectKey}` };
        },
      },
      listProducts: async () => ({ count: 1, products }),
      updateProductMediaVariants: async (input) => {
        updatedPayload = input;
      },
    },
  });

  assert.equal(summary.productsScanned, 1);
  assert.equal(summary.productsUpdated, 1);
  assert.equal(summary.imagesBackfilled, 1);

  // 1 copy of master image to s/shop_1/ast_legacy/cover.jpg + 4 variants
  assert.equal(putCalls.length, 5);
  const keys = putCalls.map((c) => c.objectKey);
  assert.ok(keys.includes("s/shop_1/ast_legacy/cover.jpg"));
  assert.ok(keys.includes("s/shop_1/ast_legacy/cover-200w.webp"));
  assert.ok(keys.includes("s/shop_1/ast_legacy/cover-400w.webp"));
  assert.ok(keys.includes("s/shop_1/ast_legacy/cover-800w.webp"));
  assert.ok(keys.includes("s/shop_1/ast_legacy/cover-1200w.webp"));

  const newCanonicalUrl =
    "https://media.ourdomain.com/ecs-media/s/shop_1/ast_legacy/cover.jpg";

  assert.equal(updatedPayload.productId, "prod_legacy");
  assert.equal(updatedPayload.tenantId, "shop_1");
  assert.equal(updatedPayload.thumbnail, newCanonicalUrl);
  assert.deepEqual(updatedPayload.images, [{ url: newCanonicalUrl }]);
  assert.ok(updatedPayload.mediaVariants[newCanonicalUrl]);
  assert.ok(updatedPayload.mediaVariants[legacyUrl]); // backward compatibility
  assert.equal(
    updatedPayload.mediaVariants[newCanonicalUrl].w200,
    "https://media.ourdomain.com/ecs-media/s/shop_1/ast_legacy/cover-200w.webp",
  );
});


