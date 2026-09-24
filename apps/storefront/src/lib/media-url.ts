import type { ImageVariants } from "./commerce/types.js";

export function normalizeStorefrontMediaUrl(
  value: string | null | undefined,
  publicBaseUrl = process.env.MEDIA_S3_PUBLIC_BASE_URL,
) {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  const trustedBase = parseHttpUrl(
    publicBaseUrl ??
      (process.env.NODE_ENV === "development" ? "http://localhost:9002/ecs-media" : undefined),
  );
  const parsed = parseHttpUrl(candidate);
  if (!trustedBase || !parsed) return null;
  const basePath = trustedBase.pathname.replace(/\/+$/, "");
  const matchesPath = parsed.pathname === basePath || parsed.pathname.startsWith(`${basePath}/`);
  return parsed.origin === trustedBase.origin && matchesPath ? parsed.toString() : null;
}

export type StorefrontMediaVariantWidth = 96 | 400 | 800 | 1200;

export function resolveProductImage(
  variants?: ImageVariants,
  preferredWidth?: keyof ImageVariants,
  fallback?: string | null,
): string | null {
  return variants?.[preferredWidth ?? "w400"] ?? fallback ?? null;
}

export function buildProductImageSrcset(
  variants?: ImageVariants,
  widths: readonly (200 | 400 | 800 | 1200)[] = [200, 400, 800, 1200],
): string | null {
  if (!variants) return null;
  const entries: string[] = [];
  for (const w of widths) {
    const key = `w${w}` as keyof ImageVariants;
    const url = variants[key];
    if (url) entries.push(`${url} ${w}w`);
  }
  return entries.length > 0 ? entries.join(", ") : null;
}

/**
 * @deprecated Use `resolveProductImage(variants, width, fallback)` instead of regex URL variant guessing.
 * Guaranteed zero 404 fallback: returns the normalized master URL directly if valid.
 */
export function resolveStorefrontMediaVariantUrl(
  value: string | null | undefined,
  _width?: StorefrontMediaVariantWidth,
  publicBaseUrl = process.env.MEDIA_S3_PUBLIC_BASE_URL,
): string | null {
  return normalizeStorefrontMediaUrl(value, publicBaseUrl) ?? value ?? null;
}

/**
 * @deprecated Use `buildProductImageSrcset(variants)` instead of regex URL variant guessing.
 */
export function buildStorefrontMediaSrcset(
  _value: string | null | undefined,
  _widths?: readonly StorefrontMediaVariantWidth[],
  _publicBaseUrl = process.env.MEDIA_S3_PUBLIC_BASE_URL,
): string | null {
  return null;
}

function parseHttpUrl(value: string | null | undefined) {
  try {
    const parsed = new URL(value ?? "");
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

