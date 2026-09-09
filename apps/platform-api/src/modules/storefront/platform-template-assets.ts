import type { createPlatformDb } from "@ecs/db";
import { auditLogs, platformAssets, storefrontTemplateVersions, storefrontTemplates } from "@ecs/db";
import { and, asc, eq, isNull, ne } from "drizzle-orm";

import {
  MediaStorageUnavailableError,
  type StorageAdapter,
  type StoredObjectMetadata,
} from "../../adapters/storage/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type PlatformAssetRow = typeof platformAssets.$inferSelect;

const allowedMimeTypes = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);
const maxPreviewBytes = 8 * 1024 * 1024;

export function createPlatformTemplateAssetService(db: PlatformDb, storage: StorageAdapter) {
  async function listTemplates() {
    const rows = await db
      .select({
        description: storefrontTemplates.description,
        name: storefrontTemplates.name,
        slug: storefrontTemplates.slug,
        status: storefrontTemplateVersions.status,
        templateId: storefrontTemplates.id,
        templateKey: storefrontTemplateVersions.templateKey,
        version: storefrontTemplateVersions.version,
        versionId: storefrontTemplateVersions.id,
        previewAltText: storefrontTemplateVersions.previewAltText,
        previewAssetId: storefrontTemplateVersions.previewAssetId,
        previewUrl: platformAssets.publicUrl,
        demoUrl: storefrontTemplateVersions.demoUrl,
      })
      .from(storefrontTemplateVersions)
      .innerJoin(storefrontTemplates, eq(storefrontTemplateVersions.templateId, storefrontTemplates.id))
      .leftJoin(
        platformAssets,
        and(eq(storefrontTemplateVersions.previewAssetId, platformAssets.id), eq(platformAssets.status, "ready")),
      )
      .orderBy(asc(storefrontTemplates.sortOrder), asc(storefrontTemplateVersions.version));
    return { ok: true as const, templates: rows };
  }

  async function createUpload(input: {
    byteSize: number;
    filename: string;
    mimeType: string;
    operatorUserId: string;
  }) {
    const filename = sanitizeFilename(input.filename);
    if (
      !filename ||
      !allowedMimeTypes.has(input.mimeType) ||
      !Number.isSafeInteger(input.byteSize) ||
      input.byteSize <= 0 ||
      input.byteSize > maxPreviewBytes
    ) {
      return error("invalid_platform_asset", 400);
    }
    const id = crypto.randomUUID();
    const objectKey = `platform/storefront-templates/pending/${id}/${filename}`;
    try {
      const upload = await storage.createUpload({
        accessMode: "public",
        byteSize: input.byteSize,
        mimeType: input.mimeType,
        objectKey,
      });
      const [asset] = await db
        .insert(platformAssets)
        .values({
          bucket: storage.bucket,
          byteSize: input.byteSize,
          createdByUserId: input.operatorUserId,
          filename,
          id,
          mimeType: input.mimeType,
          objectKey,
          publicUrl: upload.publicUrl,
          status: "pending",
          storageProvider: storage.provider,
        })
        .returning();
      if (!asset) throw new Error("Platform asset insert returned no rows.");
      return {
        asset: serializeAsset(asset),
        headers: upload.headers,
        method: upload.method,
        ok: true as const,
        uploadUrl: upload.uploadUrl,
      };
    } catch (cause) {
      if (cause instanceof MediaStorageUnavailableError) return error("media_storage_unavailable", 503);
      throw cause;
    }
  }

  async function completeUpload(input: { assetId: string; height?: number; width?: number }) {
    const asset = await findAsset(input.assetId);
    if (!asset) return error("platform_asset_not_found", 404);
    if (asset.status !== "pending" && asset.status !== "uploaded") {
      return error("invalid_platform_asset", 400);
    }
    let metadata: StoredObjectMetadata | null;
    try {
      metadata = await storage.getObjectMetadata(asset.objectKey);
    } catch (cause) {
      if (cause instanceof MediaStorageUnavailableError) return error("media_storage_unavailable", 503);
      throw cause;
    }
    if (!metadata) return error("platform_asset_upload_not_found", 409);
    if (
      metadata.byteSize !== asset.byteSize ||
      (metadata.contentType && metadata.contentType !== asset.mimeType)
    ) {
      return error("platform_asset_object_mismatch", 409);
    }
    const width = normalizeDimension(input.width);
    const height = normalizeDimension(input.height);
    if (!width || !height || width < 960 || width <= height) {
      return error("platform_asset_dimensions_invalid", 400);
    }
    const [updated] = await db
      .update(platformAssets)
      .set({ height, status: "ready", updatedAt: new Date(), width })
      .where(and(eq(platformAssets.id, asset.id), isNull(platformAssets.deletedAt)))
      .returning();
    return updated ? { asset: serializeAsset(updated), ok: true as const } : error("platform_asset_not_found", 404);
  }

  async function updateTemplatePresentation(input: {
    demoUrl?: string | null;
    operatorUserId: string;
    platformPrincipalId: string;
    previewAltText?: string | null;
    previewAssetId?: string | null;
    templateVersionId: string;
  }) {
    const [version] = await db
      .select({
        demoUrl: storefrontTemplateVersions.demoUrl,
        id: storefrontTemplateVersions.id,
        previewAltText: storefrontTemplateVersions.previewAltText,
        previewAssetId: storefrontTemplateVersions.previewAssetId,
        templateKey: storefrontTemplateVersions.templateKey,
      })
      .from(storefrontTemplateVersions)
      .where(eq(storefrontTemplateVersions.id, input.templateVersionId))
      .limit(1);
    if (!version) return error("storefront_template_version_not_found", 404);
    if (input.previewAssetId) {
      const asset = await findAsset(input.previewAssetId);
      if (!asset || asset.status !== "ready" || !asset.publicUrl) {
        return error("platform_asset_not_ready", 409);
      }
    }
    const demoUrl = input.demoUrl === undefined ? version.demoUrl : normalizePublicUrl(input.demoUrl);
    if (input.demoUrl && !demoUrl) return error("storefront_template_demo_url_invalid", 400);
    const previewAltText = input.previewAltText === undefined
      ? version.previewAltText
      : normalizeText(input.previewAltText, 180);
    const previewAssetId = input.previewAssetId === undefined
      ? version.previewAssetId
      : input.previewAssetId;
    if (previewAssetId && !previewAltText) return error("storefront_template_alt_text_required", 400);

    const [updated] = await db.transaction(async (transaction) => {
      const rows = await transaction
        .update(storefrontTemplateVersions)
        .set({
          demoUrl,
          previewAltText,
          previewAssetId,
        })
        .where(eq(storefrontTemplateVersions.id, version.id))
        .returning();
      await transaction.insert(auditLogs).values({
        action: "storefront.template_presentation_updated",
        actorUserId: input.operatorUserId,
        metadata: {
          demoUrl,
          hasPreview: Boolean(previewAssetId),
          templateKey: version.templateKey,
        },
        platformPrincipalId: input.platformPrincipalId,
        targetId: version.id,
        targetType: "storefront_template_version",
      });
      return rows;
    });
    return updated ? { ok: true as const, template: updated } : error("storefront_template_version_not_found", 404);
  }

  async function findAsset(assetId: string) {
    return db.query.platformAssets.findFirst({
      where: and(eq(platformAssets.id, assetId), ne(platformAssets.status, "deleted"), isNull(platformAssets.deletedAt)),
    });
  }

  return { completeUpload, createUpload, listTemplates, updateTemplatePresentation };
}

function serializeAsset(asset: PlatformAssetRow) {
  return {
    byteSize: asset.byteSize,
    filename: asset.filename,
    height: asset.height,
    id: asset.id,
    mimeType: asset.mimeType,
    publicUrl: asset.publicUrl,
    status: asset.status,
    width: asset.width,
  };
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}

function normalizeDimension(value: number | undefined) {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : null;
}

function normalizeText(value: string | null | undefined, max: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function normalizePublicUrl(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function error(error: string, status: 400 | 404 | 409 | 503) {
  return { error, ok: false as const, status };
}
