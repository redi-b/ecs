import { z } from "zod";

export const mediaAssetSchema = z.object({
  accessMode: z.enum(["public", "private"]),
  altText: z.string().nullable(),
  byteSize: z.number(),
  createdAt: z.string(),
  displayName: z.string(),
  filename: z.string(),
  height: z.number().nullable(),
  id: z.string().min(1),
  mimeType: z.string(),
  publicUrl: z.string().nullable(),
  status: z.enum(["pending", "uploaded", "processing", "ready", "failed", "deleted"]),
  updatedAt: z.string(),
  urls: z
    .object({
      original: z.string().nullable(),
      w96: z.string().nullable(),
      w400: z.string().nullable(),
      w800: z.string().nullable(),
      w1200: z.string().nullable(),
    })
    .optional(),
  variantsStatus: z.string().optional(),
  width: z.number().nullable(),
});

export type MediaVariantWidth = 96 | 200 | 400 | 800 | 1200;

export function toMediaVariantUrl(
  url: string | null | undefined,
  _width?: MediaVariantWidth,
): string {
  if (!url) return "";
  return url.trim();
}

