import type { createPlatformDb } from "@ecs/db";
import { mediaAssets, mediaUsages } from "@ecs/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  ne,
  or,
} from "drizzle-orm";

import {
  MediaStorageUnavailableError,
  type StorageAdapter,
  type StoredObjectMetadata,
} from "../../adapters/storage/index.js";
import type {
  MediaAsset,
  MediaAssetDeleteResult,
  MediaAssetListResult,
  MediaAssetResult,
  MediaServiceError,
  MediaUploadCreateResult,
} from "../../types/index.js";
import {
  generateObjectKey,
  mediaDisplayUrls,
  sanitizeFilename,
  type MediaVariantRecord,
} from "./variants.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type MediaAssetRow = typeof mediaAssets.$inferSelect;
type MediaOrientation = "landscape" | "portrait" | "square";
type MediaSize = "small" | "medium" | "large";
type MediaSort = "newest" | "oldest" | "name_asc" | "name_desc" | "largest" | "smallest";

const smallMediaMaxBytes = 100 * 1024;
const mediumMediaMaxBytes = 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxImageByteSize = 15 * 1024 * 1024;

export type MediaServiceDependencies = {
  updateProductMediaVariants?: (input: {
    mediaVariants: Record<string, Record<string, string>>;
    productId: string;
    tenantId: string;
  }) => Promise<unknown>;
};

export function buildProductMediaVariantsMetadata(
  assets: Array<{
    publicUrl?: string | null;
    variants?: Record<string, { publicUrl?: string | null } | undefined> | null;
  }>,
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};

  for (const asset of assets) {
    if (!asset?.publicUrl || !asset?.variants) {
      continue;
    }

    const variantsForAsset: Record<string, string> = {};
    for (const [key, variant] of Object.entries(asset.variants)) {
      if (variant?.publicUrl) {
        variantsForAsset[key] = variant.publicUrl;
      }
    }

    if (Object.keys(variantsForAsset).length > 0) {
      result[asset.publicUrl] = variantsForAsset;
    }
  }

  return result;
}

export function createMediaService(
  db: PlatformDb,
  storage: StorageAdapter,
  dependencies?: MediaServiceDependencies,
) {
  async function createUpload(input: {
    accessMode: "public" | "private";
    byteSize: number;
    context: "product" | "editor" | "settings" | "media-library";
    filename: string;
    mimeType: string;
    tenantId: string;
    userId: string;
  }): Promise<MediaUploadCreateResult> {
    const filename = sanitizeFilename(input.filename);
    if (
      !filename ||
      !allowedMimeTypes.has(input.mimeType) ||
      !Number.isSafeInteger(input.byteSize) ||
      input.byteSize <= 0 ||
      input.byteSize > maxImageByteSize
    ) {
      return mediaError("invalid_media_asset", 400);
    }

    const assetId = crypto.randomUUID();
    const objectKey = generateObjectKey({
      accessMode: input.accessMode,
      assetId,
      filename,
      tenantId: input.tenantId,
    });

    try {
      const upload = await storage.createUpload({
        accessMode: input.accessMode,
        byteSize: input.byteSize,
        mimeType: input.mimeType,
        objectKey,
      });
      const [asset] = await db
        .insert(mediaAssets)
        .values({
          accessMode: input.accessMode,
          bucket: storage.bucket,
          byteSize: input.byteSize,
          createdByUserId: input.userId,
          displayName: input.filename.trim(),
          filename,
          id: assetId,
          mimeType: input.mimeType,
          objectKey,
          publicUrl: upload.publicUrl,
          status: "pending",
          storageProvider: storage.provider,
          tenantId: input.tenantId,
        })
        .returning();

      if (!asset) throw new Error("Media asset insert returned no rows.");

      return {
        asset: toMediaAsset(asset),
        headers: upload.headers,
        method: upload.method,
        objectKey,
        ok: true,
        uploadUrl: upload.uploadUrl,
      };
    } catch (error) {
      if (error instanceof MediaStorageUnavailableError) {
        return mediaError("media_storage_unavailable", 503);
      }
      throw error;
    }
  }

  async function completeUpload(input: {
    altText?: string | null | undefined;
    assetId: string;
    height?: number | null | undefined;
    tenantId: string;
    width?: number | null | undefined;
  }): Promise<MediaAssetResult> {
    const asset = await findTenantAsset(input.tenantId, input.assetId);
    if (!asset) return mediaError("media_asset_not_found", 404);
    if (asset.status !== "pending" && asset.status !== "uploaded") {
      return mediaError("invalid_media_asset", 400);
    }

    let objectMetadata: StoredObjectMetadata | null;
    try {
      objectMetadata = await storage.getObjectMetadata(asset.objectKey);
    } catch (error) {
      if (error instanceof MediaStorageUnavailableError) {
        return mediaError("media_storage_unavailable", 503);
      }
      throw error;
    }

    if (!objectMetadata) return mediaError("media_upload_not_found", 409);
    if (
      objectMetadata.byteSize !== asset.byteSize ||
      (objectMetadata.contentType && objectMetadata.contentType !== asset.mimeType)
    ) {
      return mediaError("media_object_mismatch", 409);
    }

    const [updated] = await db
      .update(mediaAssets)
      .set({
        altText: normalizeOptionalText(input.altText),
        height: normalizeDimension(input.height),
        status: "ready",
        updatedAt: new Date(),
        width: normalizeDimension(input.width),
      })
      .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.tenantId, input.tenantId)))
      .returning();

    if (!updated) return mediaError("media_asset_not_found", 404);
    return { asset: toMediaAsset(updated), ok: true };
  }

  async function listMedia(input: {
    publicOnly?: boolean | undefined;
    limit: number;
    mimeType?: string | undefined;
    offset: number;
    orientation?: MediaOrientation | undefined;
    query?: string | undefined;
    size?: MediaSize | undefined;
    sort?: MediaSort | undefined;
    tenantId: string;
  }): Promise<MediaAssetListResult> {
    const filters = [eq(mediaAssets.tenantId, input.tenantId), eq(mediaAssets.status, "ready")];
    if (input.publicOnly)
      filters.push(eq(mediaAssets.accessMode, "public"), isNotNull(mediaAssets.publicUrl));
    if (input.mimeType) filters.push(ilike(mediaAssets.mimeType, `${input.mimeType}%`));
    if (input.query?.trim()) {
      const query = `%${input.query.trim().replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(
        or(
          ilike(mediaAssets.displayName, query),
          ilike(mediaAssets.filename, query),
          ilike(mediaAssets.altText, query),
        )!,
      );
    }
    if (input.size === "small") filters.push(lt(mediaAssets.byteSize, smallMediaMaxBytes));
    if (input.size === "medium") {
      filters.push(gte(mediaAssets.byteSize, smallMediaMaxBytes));
      filters.push(lt(mediaAssets.byteSize, mediumMediaMaxBytes));
    }
    if (input.size === "large") filters.push(gte(mediaAssets.byteSize, mediumMediaMaxBytes));
    if (input.orientation === "landscape") filters.push(gt(mediaAssets.width, mediaAssets.height));
    if (input.orientation === "portrait") filters.push(lt(mediaAssets.width, mediaAssets.height));
    if (input.orientation === "square") filters.push(eq(mediaAssets.width, mediaAssets.height));
    const where = and(...filters);
    const orderBy = (() => {
      switch (input.sort) {
        case "oldest":
          return [asc(mediaAssets.createdAt), asc(mediaAssets.id)];
        case "name_asc":
          return [asc(mediaAssets.displayName), asc(mediaAssets.id)];
        case "name_desc":
          return [desc(mediaAssets.displayName), asc(mediaAssets.id)];
        case "largest":
          return [desc(mediaAssets.byteSize), asc(mediaAssets.id)];
        case "smallest":
          return [asc(mediaAssets.byteSize), asc(mediaAssets.id)];
        default:
          return [desc(mediaAssets.createdAt), asc(mediaAssets.id)];
      }
    })();

    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(mediaAssets)
        .where(where)
        .orderBy(...orderBy)
        .limit(input.limit)
        .offset(input.offset),
      db.select({ value: count() }).from(mediaAssets).where(where),
    ]);

    return {
      assets: rows.map(toMediaAsset),
      count: total?.value ?? 0,
      limit: input.limit,
      offset: input.offset,
      ok: true,
    };
  }

  async function updateMetadata(input: {
    altText?: string | null | undefined;
    assetId: string;
    displayName?: string | undefined;
    tenantId: string;
  }): Promise<MediaAssetResult> {
    const values: { altText?: string | null; displayName?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.altText !== undefined) values.altText = normalizeOptionalText(input.altText);
    if (input.displayName !== undefined) {
      const displayName = input.displayName.trim();
      if (!displayName) return mediaError("invalid_media_asset", 400);
      values.displayName = displayName;
    }

    const [asset] = await db
      .update(mediaAssets)
      .set(values)
      .where(
        and(
          eq(mediaAssets.id, input.assetId),
          eq(mediaAssets.tenantId, input.tenantId),
          ne(mediaAssets.status, "deleted"),
        ),
      )
      .returning();

    return asset
      ? { asset: toMediaAsset(asset), ok: true }
      : mediaError("media_asset_not_found", 404);
  }

  async function deleteMedia(input: {
    assetId: string;
    tenantId: string;
  }): Promise<MediaAssetDeleteResult> {
    const asset = await findTenantAsset(input.tenantId, input.assetId);
    if (!asset) return mediaError("media_asset_not_found", 404);

    const [usage] = await db
      .select({ value: count() })
      .from(mediaUsages)
      .where(and(eq(mediaUsages.mediaAssetId, asset.id), eq(mediaUsages.tenantId, input.tenantId)));
    if ((usage?.value ?? 0) > 0) return mediaError("media_asset_in_use", 409);

    try {
      await storage.deleteObject(asset.objectKey);
      for (const variant of Object.values(asset.variants ?? {})) {
        if (variant.objectKey) await storage.deleteObject(variant.objectKey);
      }
    } catch (error) {
      if (error instanceof MediaStorageUnavailableError) {
        return mediaError("media_storage_unavailable", 503);
      }
      throw error;
    }

    const [deleted] = await db
      .update(mediaAssets)
      .set({ deletedAt: new Date(), status: "deleted", updatedAt: new Date() })
      .where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.tenantId, input.tenantId)))
      .returning({ id: mediaAssets.id });

    return deleted
      ? { deleted: true, id: deleted.id, ok: true }
      : mediaError("media_asset_not_found", 404);
  }

  async function syncProductMedia(input: {
    imageUrls: string[];
    productId: string;
    tenantId: string;
    thumbnail: string | null;
    updateProductMediaVariants?: (input: {
      mediaVariants: Record<string, Record<string, string>>;
      productId: string;
      tenantId: string;
    }) => Promise<unknown>;
  }) {
    const urls = Array.from(new Set(input.imageUrls.filter(Boolean)));
    const assets = urls.length
      ? await db
          .select({
            id: mediaAssets.id,
            publicUrl: mediaAssets.publicUrl,
            variants: mediaAssets.variants,
          })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.tenantId, input.tenantId),
              eq(mediaAssets.status, "ready"),
              inArray(mediaAssets.publicUrl, urls),
            ),
          )
      : [];
    const byUrl = new Map(assets.map((asset) => [asset.publicUrl, asset.id]));

    await db.transaction(async (transaction) => {
      await transaction
        .delete(mediaUsages)
        .where(
          and(
            eq(mediaUsages.tenantId, input.tenantId),
            eq(mediaUsages.resourceType, "product"),
            eq(mediaUsages.resourceId, input.productId),
            eq(mediaUsages.field, "images"),
          ),
        );
      const usages = urls.flatMap((url, position) => {
        const mediaAssetId = byUrl.get(url);
        return mediaAssetId
          ? [
              {
                field: "images",
                isPrimary: url === input.thumbnail,
                mediaAssetId,
                position,
                resourceId: input.productId,
                resourceType: "product" as const,
                tenantId: input.tenantId,
              },
            ]
          : [];
      });
      if (usages.length) await transaction.insert(mediaUsages).values(usages);
    });

    const mediaVariants = buildProductMediaVariantsMetadata(assets);
    const updateVariants =
      input.updateProductMediaVariants ?? dependencies?.updateProductMediaVariants;
    if (updateVariants) {
      await updateVariants({
        mediaVariants,
        productId: input.productId,
        tenantId: input.tenantId,
      });
    }

    return { count: assets.length, mediaVariants, ok: true as const };
  }

  async function findTenantAsset(tenantId: string, assetId: string) {
    return db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.tenantId, tenantId),
        ne(mediaAssets.status, "deleted"),
      ),
    });
  }

  return {
    completeUpload,
    createUpload,
    deleteMedia,
    listMedia,
    syncProductMedia,
    updateMetadata,
  };
}

function toMediaAsset(asset: MediaAssetRow): MediaAsset {
  return {
    accessMode: asset.accessMode,
    altText: asset.altText,
    byteSize: asset.byteSize,
    createdAt: asset.createdAt.toISOString(),
    displayName: asset.displayName,
    filename: asset.filename,
    height: asset.height,
    id: asset.id,
    mimeType: asset.mimeType,
    publicUrl: asset.publicUrl,
    status: asset.status,
    updatedAt: asset.updatedAt.toISOString(),
    urls: mediaDisplayUrls(asset.publicUrl, asset.variants as Record<string, MediaVariantRecord>),
    variantsStatus: asset.variantsStatus,
    width: asset.width,
  };
}


function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDimension(value: number | null | undefined) {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? (value ?? null) : null;
}

function mediaError(
  error: MediaServiceError["error"],
  status: MediaServiceError["status"],
): MediaServiceError {
  return { error, ok: false, status };
}
