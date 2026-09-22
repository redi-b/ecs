export const MEDIA_VARIANT_WIDTHS = [200, 400, 800, 1200] as const;
export type MediaVariantWidth = (typeof MEDIA_VARIANT_WIDTHS)[number];

export type MediaVariantRecord = {
  byteSize: number;
  height: number;
  objectKey: string;
  publicUrl: string | null;
  width: number;
};

export function generateObjectKey(input: {
  accessMode: "public" | "private";
  assetId: string;
  filename: string;
  scope?: string;
  tenantId?: string;
}) {
  const cleanFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = input.tenantId
    ? `s/${input.tenantId}/${input.assetId}/${cleanFilename}`
    : `p/${input.scope ?? "general"}/${input.assetId}/${cleanFilename}`;
  return input.accessMode === "private" ? `private/${path}` : path;
}

export function generatePlatformObjectKey(input: {
  assetId: string;
  filename: string;
  scope: string;
}) {
  const cleanFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `p/${input.scope}/${input.assetId}/${cleanFilename}`;
}

export function shouldSkipImageProcessing(input: {
  mimeType: string;
  pageCount?: number | undefined;
}) {
  if (input.mimeType === "image/gif") return true;
  if ((input.pageCount ?? 1) > 1) return true;
  return false;
}

export function variantObjectKey(originalKey: string, width: MediaVariantWidth) {
  const dotIndex = originalKey.lastIndexOf(".");
  const basePath = dotIndex >= 0 ? originalKey.slice(0, dotIndex) : originalKey;
  return `${basePath}-${width}w.webp`;
}

export function mediaDisplayUrls(
  publicUrl: string | null,
  variants: Record<string, MediaVariantRecord> | null | undefined,
) {
  const original = publicUrl;
  const pick = (width: number) => variants?.[`w${width}`]?.publicUrl ?? original;
  return {
    original,
    w96: pick(96),
    w400: pick(400),
    w800: pick(800),
    w1200: pick(1200),
  };
}
