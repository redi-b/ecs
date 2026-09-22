import sharp from "sharp";

import type { StorageAdapter } from "../../adapters/storage/index.js";
import {
  MEDIA_VARIANT_WIDTHS,
  type MediaVariantRecord,
  type MediaVariantWidth,
  shouldSkipImageProcessing,
  variantObjectKey,
} from "./variants.js";

export const MEDIA_VARIANT_QUALITY: Record<MediaVariantWidth, number> = {
  200: 82,
  400: 80,
  800: 80,
  1200: 82,
};

export const MEDIA_VARIANT_CACHE_CONTROL = "public, max-age=31536000, immutable";

export type ProcessMediaAssetResult =
  | { skipped: true }
  | {
      height?: number | undefined;
      skipped: false;
      variants: Record<string, MediaVariantRecord>;
      width?: number | undefined;
    };

export async function processMediaAssetImage(input: {
  mimeType: string;
  objectKey: string;
  storage: StorageAdapter;
}): Promise<ProcessMediaAssetResult> {
  if (shouldSkipImageProcessing({ mimeType: input.mimeType })) {
    return { skipped: true };
  }

  const original = await input.storage.getObject(input.objectKey);
  if (!original) return { skipped: true };

  const source = sharp(original, { failOn: "none" }).rotate();
  const metadata = await source.metadata();
  if (shouldSkipImageProcessing({ mimeType: input.mimeType, pageCount: metadata.pages })) {
    return { skipped: true };
  }

  const isRotated90 = (metadata.orientation ?? 0) >= 5 && (metadata.orientation ?? 0) <= 8;
  const sourceWidth = (isRotated90 ? metadata.height : metadata.width) ?? 0;
  const sourceHeight = (isRotated90 ? metadata.width : metadata.height) ?? 0;
  const variants: Record<string, MediaVariantRecord> = {};

  for (const width of MEDIA_VARIANT_WIDTHS) {
    if (sourceWidth > 0 && sourceWidth < width) continue;
    const quality = MEDIA_VARIANT_QUALITY[width] ?? 80;
    const buffer = await source
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 4, quality })
      .toBuffer();
    const info = await sharp(buffer).metadata();
    const objectKey = variantObjectKey(input.objectKey, width);
    const stored = await input.storage.putObject({
      body: buffer,
      cacheControl: MEDIA_VARIANT_CACHE_CONTROL,
      contentType: "image/webp",
      objectKey,
    });
    variants[`w${width}`] = {
      byteSize: buffer.byteLength,
      height: info.height ?? width,
      objectKey,
      publicUrl: stored.publicUrl,
      width: info.width ?? width,
    };
  }

  return {
    height: sourceHeight || undefined,
    skipped: false,
    variants,
    width: sourceWidth || undefined,
  };
}

