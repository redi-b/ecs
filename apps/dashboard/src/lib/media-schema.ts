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

export type MediaVariantWidth = 96 | 400 | 800 | 1200;

export function toMediaVariantUrl(
  url: string | null | undefined,
  width: MediaVariantWidth,
): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (lower.endsWith(".gif") || lower.endsWith(".svg")) return trimmed;

  const match = trimmed.match(/^(.*\/tenants\/[^/]+\/.+\/)([^/?#]+)(\?.*)?$/);
  if (!match) return trimmed;

  const prefix = match[1];
  const search = match[3] ?? "";
  return `${prefix}w${width}.webp${search}`;
}

