import sharp from "sharp";

import type { StorageAdapter } from "../../adapters/storage/index.js";
import {
  MEDIA_VARIANT_WIDTHS,
  type MediaVariantRecord,
  shouldSkipImageProcessing,
  variantObjectKey,
} from "./variants.js";

export async function processMediaAssetImage(input: {
  mimeType: string;
  objectKey: string;
  storage: StorageAdapter;
}): Promise<{ skipped: true } | { skipped: false; variants: Record<string, MediaVariantRecord> }> {
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

  const sourceWidth = metadata.width ?? 0;
  const variants: Record<string, MediaVariantRecord> = {};

  for (const width of MEDIA_VARIANT_WIDTHS) {
    if (sourceWidth > 0 && sourceWidth < width) continue;
    const buffer = await source
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 4, quality: 80 })
      .toBuffer();
    const info = await sharp(buffer).metadata();
    const objectKey = variantObjectKey(input.objectKey, width);
    const stored = await input.storage.putObject({
      body: buffer,
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

  return { skipped: false, variants };
}
