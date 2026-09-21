export const MEDIA_VARIANT_WIDTHS = [96, 400, 800, 1200] as const;
export type MediaVariantWidth = (typeof MEDIA_VARIANT_WIDTHS)[number];

export type MediaVariantRecord = {
  byteSize: number;
  height: number;
  objectKey: string;
  publicUrl: string | null;
  width: number;
};

export function shouldSkipImageProcessing(input: {
  mimeType: string;
  pageCount?: number | undefined;
}) {
  if (input.mimeType === "image/gif") return true;
  if ((input.pageCount ?? 1) > 1) return true;
  return false;
}

export function variantObjectKey(originalKey: string, width: MediaVariantWidth) {
  const slash = originalKey.lastIndexOf("/");
  const folder = slash >= 0 ? originalKey.slice(0, slash + 1) : "";
  return `${folder}w${width}.webp`;
}

export function mediaDisplayUrls(
  publicUrl: string | null,
  variants: Record<string, MediaVariantRecord> | null | undefined,
) {
  const original = publicUrl;
  const pick = (width: MediaVariantWidth) => variants?.[`w${width}`]?.publicUrl ?? original;
  return {
    original,
    w96: pick(96),
    w400: pick(400),
    w800: pick(800),
    w1200: pick(1200),
  };
}
