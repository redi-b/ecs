import test from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/pg-proxy";
import {
  assertProductMediaUpdateSucceeded,
  buildProductMediaVariantsMetadata,
  createMediaService,
} from "./service.js";

test("failed Medusa metadata updates fail media synchronization", () => {
  assert.doesNotThrow(() => assertProductMediaUpdateSucceeded({ ok: true }));
  assert.throws(
    () => assertProductMediaUpdateSucceeded({ ok: false, error: "commerce_unavailable" }),
    /product_media_metadata_update_failed/,
  );
});

test("buildProductMediaVariantsMetadata maps asset variants to original public URLs", () => {
  const assets = [
    {
      publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero.png",
      variants: {
        w200: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp" },
        w400: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp" },
      },
    },
  ];

  const metadata = buildProductMediaVariantsMetadata(assets as any);
  assert.deepEqual(metadata, {
    "https://media.ourdomain.com/s/shop_1/ast_1/hero.png": {
      w200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp",
      w400: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp",
    },
  });
});

test("buildProductMediaVariantsMetadata supports all 4 WebP tiers and ignores invalid entries", () => {
  const assets = [
    {
      publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero.png",
      variants: {
        w200: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp" },
        w400: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp" },
        w800: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-800w.webp" },
        w1200: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-1200w.webp" },
      },
    },
    {
      publicUrl: "https://media.ourdomain.com/s/shop_1/ast_2/pending.png",
      variants: null,
    },
    {
      publicUrl: null,
      variants: {
        w200: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_3/x-200w.webp" },
      },
    },
  ];

  const metadata = buildProductMediaVariantsMetadata(assets as any);
  assert.deepEqual(metadata, {
    "https://media.ourdomain.com/s/shop_1/ast_1/hero.png": {
      w200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp",
      w400: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp",
      w800: "https://media.ourdomain.com/s/shop_1/ast_1/hero-800w.webp",
      w1200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-1200w.webp",
    },
  });
});

test("syncProductMedia persists mediaUsages and invokes updateProductMediaVariants with deterministic metadata", async () => {
  const heroUrl = "https://media.ourdomain.com/s/shop_1/ast_1/hero.png";
  const detailUrl = "https://media.ourdomain.com/s/shop_1/ast_2/detail.png";

  const executedQueries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    executedQueries.push({ sql, params });
    if (sql.toLowerCase().includes('from "media_assets"')) {
      return {
        rows: [
          [
            "ast_1",
            heroUrl,
            {
              w200: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp" },
              w400: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp" },
              w800: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-800w.webp" },
              w1200: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_1/hero-1200w.webp" },
            },
          ],
          [
            "ast_2",
            detailUrl,
            {
              w200: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_2/detail-200w.webp" },
              w400: { publicUrl: "https://media.ourdomain.com/s/shop_1/ast_2/detail-400w.webp" },
            },
          ],
        ],
      };
    }
    return { rows: [] };
  });
  (db as any).transaction = async (callback: any) => callback(db);

  let syncedMetadata:
    | {
        mediaVariants: Record<string, Record<string, string>>;
        productId: string;
        tenantId: string;
      }
    | undefined;

  const service = createMediaService(
    db as unknown as Parameters<typeof createMediaService>[0],
    {} as Parameters<typeof createMediaService>[1],
    {
      updateProductMediaVariants: async (input) => {
        syncedMetadata = input;
      },
    },
  );

  const result = await service.syncProductMedia({
    imageUrls: [heroUrl, detailUrl],
    productId: "prod_123",
    tenantId: "shop_1",
    thumbnail: heroUrl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.count, 2);

  // Verify Medusa metadata variants update was called
  assert.deepEqual(syncedMetadata, {
    mediaVariants: {
      [heroUrl]: {
        w200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-200w.webp",
        w400: "https://media.ourdomain.com/s/shop_1/ast_1/hero-400w.webp",
        w800: "https://media.ourdomain.com/s/shop_1/ast_1/hero-800w.webp",
        w1200: "https://media.ourdomain.com/s/shop_1/ast_1/hero-1200w.webp",
      },
      [detailUrl]: {
        w200: "https://media.ourdomain.com/s/shop_1/ast_2/detail-200w.webp",
        w400: "https://media.ourdomain.com/s/shop_1/ast_2/detail-400w.webp",
      },
    },
    productId: "prod_123",
    tenantId: "shop_1",
  });

  // Verify mediaUsages queries were executed (delete old usages + insert new usages)
  const deleteQuery = executedQueries.find((q) => q.sql.toLowerCase().includes('delete from "media_usages"'));
  assert.ok(deleteQuery, "Expected DELETE FROM media_usages to execute");

  const insertQuery = executedQueries.find((q) => q.sql.toLowerCase().includes('insert into "media_usages"'));
  assert.ok(insertQuery, "Expected INSERT INTO media_usages to execute");
});
