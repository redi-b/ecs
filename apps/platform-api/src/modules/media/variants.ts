export const MEDIA_VARIANT_WIDTHS = [200, 400, 800, 1200] as const;
export type MediaVariantWidth = (typeof MEDIA_VARIANT_WIDTHS)[number];

export type MediaVariantRecord = {
  byteSize: number;
  height: number;
  objectKey: string;
  publicUrl: string | null;
  width: number;
};

export function sanitizeFilename(value: string) {
  return value
    .trim()
    .replace(/^.*[/\\]/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export type GenerateTenantObjectKeyInput = {
  accessMode: "public" | "private";
  assetId: string;
  filename: string;
  tenantId: string;
  scope?: never;
};

export type GeneratePlatformObjectKeyInput = {
  accessMode?: "public" | "private";
  assetId: string;
  filename: string;
  scope: string;
  tenantId?: never;
};

export type GenerateObjectKeyInput =
  | GenerateTenantObjectKeyInput
  | GeneratePlatformObjectKeyInput;

export function generateObjectKey(input: GenerateObjectKeyInput) {
  const cleanFilename = sanitizeFilename(input.filename);
  const path = input.tenantId
    ? `s/${input.tenantId}/${input.assetId}/${cleanFilename}`
    : `p/${input.scope}/${input.assetId}/${cleanFilename}`;
  return input.accessMode === "private" ? `private/${path}` : path;
}

export function generatePlatformObjectKey(input: GeneratePlatformObjectKeyInput) {
  return generateObjectKey(input);
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
  const slash = originalKey.lastIndexOf("/");
  const dot = originalKey.lastIndexOf(".");
  const basePath = dot > slash ? originalKey.slice(0, dot) : originalKey;
  return `${basePath}-${width}w.webp`;
}

export function mediaDisplayUrls(
  publicUrl: string | null,
  variants: Record<string, MediaVariantRecord> | null | undefined,
) {
  const original = publicUrl;
  const pick = (width: MediaVariantWidth) => variants?.[`w${width}`]?.publicUrl ?? original;
  return {
    original,
    w200: pick(200),
    w400: pick(400),
    w800: pick(800),
    w1200: pick(1200),
    w96: pick(200),
  };
}
