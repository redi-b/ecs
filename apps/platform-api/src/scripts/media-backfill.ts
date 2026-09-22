import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { eq } from "drizzle-orm";

import {
  createPlatformDb,
  mediaAssets,
  tenants,
} from "@ecs/db";
import {
  createMediaStorageFromEnv,
  type StorageAdapter,
} from "../adapters/storage/index.js";
import {
  MEDIA_VARIANT_CACHE_CONTROL,
  MEDIA_VARIANT_QUALITY,
} from "../modules/media/process-asset.js";
import {
  MEDIA_VARIANT_WIDTHS,
  type MediaVariantRecord,
  sanitizeFilename,
  variantObjectKey,
} from "../modules/media/variants.js";
import { createMedusaProductService } from "../adapters/medusa/product/service.js";
import { resolveMedusaAdminToken } from "../adapters/medusa/admin-token.js";
import { loadPlatformApiEnvFiles } from "../config/env.js";

export const REQUIRED_VARIANT_KEYS = ["w200", "w400", "w800", "w1200"] as const;

export type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type MedusaProductForBackfill = {
  id: string;
  images?: Array<{ id?: string; url: string }> | null;
  metadata?: Record<string, unknown> | null;
  salesChannelId?: string;
  tenantId?: string;
  thumbnail?: string | null;
  title?: string | null;
};

export type BackfillCliOptions = {
  concurrency: number;
  dryRun: boolean;
  limit?: number;
  tenantId?: string;
};

export type BackfillDependencies = {
  db?: PlatformDb;
  listProducts: (options: {
    limit?: number;
    offset?: number;
    tenantId?: string;
  }) => Promise<{
    count: number;
    products: MedusaProductForBackfill[];
  }>;
  logger?: {
    error: (msg: string, ...args: unknown[]) => void;
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
  };
  processImage?: (input: {
    imageUrl: string;
    storage: StorageAdapter;
    tenantId?: string;
  }) => Promise<
    | {
        variantRecords?: Record<string, MediaVariantRecord>;
        variantUrls: Record<string, string>;
      }
    | Record<string, string>
    | null
  >;
  storage: StorageAdapter;
  updateProductMediaVariants: (input: {
    mediaVariants: Record<string, Record<string, string>>;
    productId: string;
    tenantId?: string;
  }) => Promise<unknown>;
};

export type BackfillSummary = {
  durationMs: number;
  imagesBackfilled: number;
  imagesFailed: number;
  imagesScanned: number;
  imagesSkipped: number;
  productsScanned: number;
  productsUpdated: number;
};

export function shouldBackfillProductImage(
  url: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!url || typeof url !== "string" || !url.trim()) {
    return false;
  }
  const mediaVariants = metadata?.media_variants;
  if (!mediaVariants || typeof mediaVariants !== "object" || mediaVariants === null) {
    return true;
  }
  const imageVariants = (mediaVariants as Record<string, unknown>)[url];
  if (!imageVariants || typeof imageVariants !== "object" || imageVariants === null) {
    return true;
  }
  for (const key of REQUIRED_VARIANT_KEYS) {
    const val = (imageVariants as Record<string, unknown>)[key];
    if (!val || typeof val !== "string" || !val.trim()) {
      return true;
    }
  }
  return false;
}

export function parseBackfillArgs(args: string[]): BackfillCliOptions {
  let dryRun = false;
  let tenantId: string | undefined;
  let limit: number | undefined;
  let concurrency = 5;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--tenant" && i + 1 < args.length) {
      tenantId = args[++i]?.trim() || undefined;
    } else if (arg.startsWith("--tenant=")) {
      tenantId = arg.slice("--tenant=".length).trim() || undefined;
    } else if (arg === "--limit" && i + 1 < args.length) {
      const parsed = Number.parseInt(args[++i] ?? "", 10);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        limit = parsed;
      }
    } else if (arg.startsWith("--limit=")) {
      const parsed = Number.parseInt(arg.slice("--limit=".length), 10);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        limit = parsed;
      }
    } else if (arg === "--concurrency" && i + 1 < args.length) {
      const parsed = Number.parseInt(args[++i] ?? "", 10);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        concurrency = parsed;
      }
    } else if (arg.startsWith("--concurrency=")) {
      const parsed = Number.parseInt(arg.slice("--concurrency=".length), 10);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        concurrency = parsed;
      }
    }
  }

  const result: BackfillCliOptions = { concurrency, dryRun };
  if (limit !== undefined) result.limit = limit;
  if (tenantId !== undefined) result.tenantId = tenantId;
  return result;
}

export function extractProductImages(product: {
  images?: Array<{ url?: string | null } | string> | null;
  thumbnail?: string | null;
}): string[] {
  const urls = new Set<string>();
  if (product.thumbnail && typeof product.thumbnail === "string" && product.thumbnail.trim()) {
    urls.add(product.thumbnail.trim());
  }
  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      const url = typeof img === "string" ? img : img?.url;
      if (url && typeof url === "string" && url.trim()) {
        urls.add(url.trim());
      }
    }
  }
  return Array.from(urls);
}

export function getObjectKeyFromUrl(
  imageUrl: string,
  tenantId?: string,
  bucket?: string,
): string {
  try {
    const parsed = new URL(imageUrl);
    let pathname = parsed.pathname.replace(/^\/+/, "");
    if (bucket && pathname.startsWith(`${bucket}/`)) {
      pathname = pathname.slice(bucket.length + 1);
    }
    if (pathname.startsWith("s/") || pathname.startsWith("p/")) {
      return pathname;
    }
  } catch {
    let clean = imageUrl.replace(/^\/+/, "");
    if (bucket && clean.startsWith(`${bucket}/`)) {
      clean = clean.slice(bucket.length + 1);
    }
    if (clean.startsWith("s/") || clean.startsWith("p/")) {
      return clean;
    }
  }

  const filename = sanitizeFilename(imageUrl.split("/").pop() || "image.png") || "image.png";
  const hash = createHash("sha256").update(imageUrl).digest("hex").slice(0, 12);
  const prefix = tenantId ? `s/${tenantId}/backfill` : "p/backfill";
  return `${prefix}/${hash}/${filename}`;
}

export function resolveVariantUrlFromSource(sourceUrl: string, variantKey: string): string {
  try {
    const parsed = new URL(sourceUrl);
    return `${parsed.origin}/${variantKey}`;
  } catch {
    return `/${variantKey}`;
  }
}

export async function getMasterImageBuffer(
  imageUrl: string,
  objectKey: string,
  storage: StorageAdapter,
): Promise<Buffer | null> {
  try {
    const s3Bytes = await storage.getObject(objectKey);
    if (s3Bytes && s3Bytes.length > 0) {
      return Buffer.from(s3Bytes);
    }
  } catch {
    // Fall back to HTTP fetch
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const response = await fetch(imageUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

export async function processAndUploadVariants(input: {
  buffer: Buffer;
  objectKey: string;
  sourceUrl?: string;
  storage: StorageAdapter;
}): Promise<{
  variantRecords: Record<string, MediaVariantRecord>;
  variantUrls: Record<string, string>;
}> {
  const source = sharp(input.buffer, { failOn: "none" }).rotate();
  const variantUrls: Record<string, string> = {};
  const variantRecords: Record<string, MediaVariantRecord> = {};

  for (const width of MEDIA_VARIANT_WIDTHS) {
    const quality = MEDIA_VARIANT_QUALITY[width] ?? 80;
    const variantBuffer = await source
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 4, quality })
      .toBuffer();

    const info = await sharp(variantBuffer).metadata();
    const variantKey = variantObjectKey(input.objectKey, width);
    const stored = await input.storage.putObject({
      body: variantBuffer,
      cacheControl: MEDIA_VARIANT_CACHE_CONTROL,
      contentType: "image/webp",
      objectKey: variantKey,
    });

    const publicUrl =
      stored.publicUrl ||
      (input.sourceUrl
        ? resolveVariantUrlFromSource(input.sourceUrl, variantKey)
        : `/${variantKey}`);

    variantUrls[`w${width}`] = publicUrl;
    variantRecords[`w${width}`] = {
      byteSize: variantBuffer.byteLength,
      height: info.height ?? width,
      objectKey: variantKey,
      publicUrl,
      width: info.width ?? width,
    };
  }

  return { variantRecords, variantUrls };
}

export function createConcurrencyLimiter(concurrency: number) {
  const max = Math.max(1, concurrency);
  let active = 0;
  const queue: Array<() => void> = [];

  const release = () => {
    active--;
    if (queue.length > 0 && active < max) {
      active++;
      const runNext = queue.shift();
      if (runNext) runNext();
    }
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    } else {
      active++;
    }

    try {
      return await fn();
    } finally {
      release();
    }
  };
}

export async function runBackfill(input: {
  dependencies: BackfillDependencies;
  options: BackfillCliOptions;
}): Promise<BackfillSummary> {
  const startTime = Date.now();
  const { options, dependencies } = input;
  const limiter = createConcurrencyLimiter(options.concurrency);
  const logger = dependencies.logger ?? {
    error: (msg: string, ...args: unknown[]) => console.error(`[media:backfill] ERROR: ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.log(`[media:backfill] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`[media:backfill] WARN: ${msg}`, ...args),
  };

  let productsScanned = 0;
  let productsUpdated = 0;
  let imagesScanned = 0;
  let imagesSkipped = 0;
  let imagesBackfilled = 0;
  let imagesFailed = 0;

  logger.info(
    `Starting backfill (dryRun=${options.dryRun}, concurrency=${options.concurrency}, tenant=${options.tenantId ?? "all"}, limit=${options.limit ?? "none"})`,
  );

  const queryOpts: { limit?: number; tenantId?: string } = {};
  if (options.limit !== undefined) queryOpts.limit = options.limit;
  if (options.tenantId !== undefined) queryOpts.tenantId = options.tenantId;

  const productList = await dependencies.listProducts(queryOpts);

  for (const product of productList.products) {
    productsScanned++;
    const imageUrls = extractProductImages(product);
    const urlsToBackfill: string[] = [];

    for (const url of imageUrls) {
      imagesScanned++;
      if (shouldBackfillProductImage(url, product.metadata)) {
        urlsToBackfill.push(url);
      } else {
        imagesSkipped++;
      }
    }

    if (urlsToBackfill.length === 0) {
      continue;
    }

    if (options.dryRun) {
      logger.info(
        `[DRY-RUN] Product ${product.id} (${product.title ?? "untitled"}): ${urlsToBackfill.length} image(s) need backfill: ${urlsToBackfill.join(", ")}`,
      );
      imagesBackfilled += urlsToBackfill.length;
      continue;
    }

    logger.info(`Product ${product.id}: processing ${urlsToBackfill.length} image(s)...`);

    const productNewVariants: Record<string, Record<string, string>> = {};
    const effectiveTenantId = product.tenantId ?? options.tenantId;

    const imageResults = await Promise.all(
      urlsToBackfill.map((url) =>
        limiter(async () => {
          try {
            if (dependencies.processImage) {
              const processInput: { imageUrl: string; storage: StorageAdapter; tenantId?: string } = {
                imageUrl: url,
                storage: dependencies.storage,
              };
              if (effectiveTenantId) processInput.tenantId = effectiveTenantId;
              const res = await dependencies.processImage(processInput);
              if (!res) return { url, variantRecords: undefined, variantUrls: null };
              const variantUrls =
                "variantUrls" in res
                  ? (res.variantUrls as Record<string, string>)
                  : (res as Record<string, string>);
              const variantRecords =
                "variantRecords" in res
                  ? (res.variantRecords as Record<string, MediaVariantRecord>)
                  : undefined;
              return { url, variantRecords, variantUrls };
            }

            const objectKey = getObjectKeyFromUrl(
              url,
              effectiveTenantId,
              dependencies.storage.bucket,
            );

            const buffer = await getMasterImageBuffer(
              url,
              objectKey,
              dependencies.storage,
            );

            if (!buffer) {
              logger.warn(`Could not load master image buffer for ${url}`);
              return { url, variantRecords: undefined, variantUrls: null };
            }

            const { variantRecords, variantUrls } = await processAndUploadVariants({
              buffer,
              objectKey,
              sourceUrl: url,
              storage: dependencies.storage,
            });

            return { url, variantRecords, variantUrls };
          } catch (err) {
            logger.error(`Failed to process image ${url}:`, err);
            return { url, variantRecords: undefined, variantUrls: null };
          }
        }),
      ),
    );

    for (const res of imageResults) {
      if (res.variantUrls && Object.keys(res.variantUrls).length > 0) {
        productNewVariants[res.url] = res.variantUrls;
        imagesBackfilled++;
      } else {
        imagesFailed++;
      }
    }

    if (Object.keys(productNewVariants).length > 0) {
      const existingVariants =
        product.metadata?.media_variants &&
        typeof product.metadata.media_variants === "object"
          ? (product.metadata.media_variants as Record<string, Record<string, string>>)
          : {};

      const mergedVariants = {
        ...existingVariants,
        ...productNewVariants,
      };

      const updatePayload: {
        mediaVariants: Record<string, Record<string, string>>;
        productId: string;
        tenantId?: string;
      } = {
        mediaVariants: mergedVariants,
        productId: product.id,
      };
      if (effectiveTenantId) {
        updatePayload.tenantId = effectiveTenantId;
      }

      await dependencies.updateProductMediaVariants(updatePayload);

      // Synchronize media_assets DB rows if platform DB is connected
      if (dependencies.db) {
        try {
          for (const res of imageResults) {
            if (res.variantRecords && Object.keys(res.variantRecords).length > 0) {
              await dependencies.db
                .update(mediaAssets)
                .set({
                  updatedAt: new Date(),
                  variants: res.variantRecords,
                  variantsStatus: "ready",
                })
                .where(eq(mediaAssets.publicUrl, res.url));
            }
          }
        } catch (err) {
          logger.warn(`Could not update media_assets table for product ${product.id}:`, err);
        }
      }

      productsUpdated++;
      logger.info(
        `Product ${product.id}: updated metadata.media_variants with ${Object.keys(productNewVariants).length} image(s).`,
      );
    }
  }

  const durationMs = Date.now() - startTime;
  logger.info(
    `Backfill completed in ${durationMs}ms: ${productsScanned} products scanned, ${productsUpdated} products updated, ${imagesScanned} images scanned, ${imagesBackfilled} backfilled, ${imagesSkipped} skipped, ${imagesFailed} failed.`,
  );

  return {
    durationMs,
    imagesBackfilled,
    imagesFailed,
    imagesScanned,
    imagesSkipped,
    productsScanned,
    productsUpdated,
  };
}

export async function fetchMedusaCatalogProducts(input: {
  adminApiToken: string;
  limit?: number;
  medusaInternalUrl: string;
  salesChannelId?: string;
}): Promise<{ count: number; products: MedusaProductForBackfill[] }> {
  const products: MedusaProductForBackfill[] = [];
  const pageSize = 50;
  let offset = 0;
  let totalCount = 0;

  while (true) {
    const url = new URL("/admin/products", input.medusaInternalUrl);
    const fetchLimit = input.limit
      ? Math.min(pageSize, input.limit - products.length)
      : pageSize;
    if (fetchLimit <= 0) break;

    url.searchParams.set("limit", String(fetchLimit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set(
      "fields",
      "id,title,thumbnail,metadata,sales_channels.id,images.id,images.url",
    );
    if (input.salesChannelId) {
      url.searchParams.append("sales_channel_id[]", input.salesChannelId);
    }

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Basic ${input.adminApiToken}`,
      },
    }).catch(() => null);

    if (!response || !response.ok) {
      break;
    }

    const data = (await response.json().catch(() => null)) as {
      count?: number;
      products?: unknown[];
    } | null;

    if (typeof data?.count === "number") {
      totalCount = data.count;
    }

    const rawList = Array.isArray(data?.products) ? data.products : [];
    if (rawList.length === 0) break;

    for (const raw of rawList) {
      if (!raw || typeof raw !== "object") continue;
      const p = raw as Record<string, unknown>;
      const id = typeof p.id === "string" ? p.id : "";
      if (!id) continue;

      const salesChannels = Array.isArray(p.sales_channels)
        ? (p.sales_channels as Array<{ id: string }>)
        : [];

      const productItem: MedusaProductForBackfill = {
        id,
        images: Array.isArray(p.images)
          ? (p.images as Array<{ url: string }>)
          : [],
        metadata:
          p.metadata && typeof p.metadata === "object"
            ? (p.metadata as Record<string, unknown>)
            : {},
        thumbnail: typeof p.thumbnail === "string" ? p.thumbnail : null,
        title: typeof p.title === "string" ? p.title : null,
      };
      if (salesChannels[0]?.id) {
        productItem.salesChannelId = salesChannels[0].id;
      }

      products.push(productItem);

      if (input.limit && products.length >= input.limit) {
        return { count: totalCount || products.length, products };
      }
    }

    offset += rawList.length;
    if (totalCount && offset >= totalCount) break;
  }

  return { count: totalCount || products.length, products };
}

export async function main() {
  loadPlatformApiEnvFiles();
  const options = parseBackfillArgs(process.argv.slice(2));

  const connectionString = process.env.PLATFORM_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("PLATFORM_DATABASE_URL is required");
  }
  const { db, pool } = createPlatformDb({ connectionString, max: 2 });

  try {
    const storage = createMediaStorageFromEnv();
    const medusaInternalUrl = process.env.MEDUSA_INTERNAL_URL ?? "http://localhost:9000";

    const adminTokenResult = await resolveMedusaAdminToken({
      db,
      envToken: process.env.MEDUSA_ADMIN_API_TOKEN,
      internalApiToken:
        process.env.PLATFORM_INTERNAL_API_TOKEN ??
        (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token"),
      medusaInternalUrl,
    });

    if (!adminTokenResult.ok) {
      throw new Error(`Medusa admin token unavailable: ${adminTokenResult.error}`);
    }

    const productService = createMedusaProductService({
      adminApiToken: adminTokenResult.token,
      medusaInternalUrl,
    });

    let salesChannelId: string | undefined;
    if (options.tenantId) {
      const [tenantRow] = await db
        .select({ id: tenants.id, medusaSalesChannelId: tenants.medusaSalesChannelId })
        .from(tenants)
        .where(eq(tenants.id, options.tenantId))
        .limit(1);
      salesChannelId = tenantRow?.medusaSalesChannelId ?? undefined;
    }

    const listProducts = async (queryOpts: {
      limit?: number;
      offset?: number;
      tenantId?: string;
    }) => {
      const fetchInput: {
        adminApiToken: string;
        limit?: number;
        medusaInternalUrl: string;
        salesChannelId?: string;
      } = {
        adminApiToken: adminTokenResult.token,
        medusaInternalUrl,
      };
      if (queryOpts.limit !== undefined) fetchInput.limit = queryOpts.limit;
      if (salesChannelId !== undefined) fetchInput.salesChannelId = salesChannelId;

      return fetchMedusaCatalogProducts(fetchInput);
    };

    const updateProductMediaVariants = async (inputPayload: {
      mediaVariants: Record<string, Record<string, string>>;
      productId: string;
      tenantId?: string;
    }) => {
      return productService.updateProductMediaVariants(inputPayload);
    };

    await runBackfill({
      dependencies: {
        db,
        listProducts,
        storage,
        updateProductMediaVariants,
      },
      options,
    });
  } finally {
    await pool.end();
  }
}

const isMainModule = Boolean(
  process.argv[1] &&
    (process.argv[1] === fileURLToPath(import.meta.url) ||
      process.argv[1].endsWith("/media-backfill.ts") ||
      process.argv[1].endsWith("/media-backfill.js") ||
      process.argv[1].endsWith("media-backfill")),
);

if (isMainModule) {
  main().catch((err) => {
    console.error("[media:backfill] Fatal error:", err);
    process.exit(1);
  });
}
