"use client";

export type ProductMediaVariantsMap = Record<
  string,
  {
    w200?: string | null;
    w400?: string | null;
    w800?: string | null;
    w1200?: string | null;
    [key: string]: string | null | undefined;
  }
>;

/**
 * Resolves a deterministic WebP image derivative for a product image if available,
 * falling back gracefully to the original master URL.
 */
export function resolveProductMediaVariant(
  url: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  preferredTier: "w200" | "w400" | "w800" | "w1200" = "w400",
): string {
  if (!url) return "";
  const mediaVariants = (metadata as { media_variants?: ProductMediaVariantsMap } | undefined)
    ?.media_variants;
  const entry = mediaVariants?.[url];
  if (!entry) return url;

  if (preferredTier === "w200") {
    return entry.w200 || entry.w400 || url;
  }
  if (preferredTier === "w400") {
    return entry.w400 || entry.w800 || entry.w200 || url;
  }
  if (preferredTier === "w800") {
    return entry.w800 || entry.w1200 || entry.w400 || url;
  }
  if (preferredTier === "w1200") {
    return entry.w1200 || entry.w800 || url;
  }
  return url;
}

/**
 * Finds which option value an image is tagged with from option_media_bindings.
 */
export function getImageOptionTag(
  url: string,
  bindings: Record<string, unknown> | null | undefined,
): { optionTitle: string; optionValue: string } | null {
  if (!bindings || typeof bindings !== "object") return null;
  const optionTitle =
    typeof (bindings as { optionTitle?: string }).optionTitle === "string"
      ? (bindings as { optionTitle: string }).optionTitle.trim()
      : "";
  const mappings = (bindings as { mappings?: Record<string, string[]> }).mappings;
  if (!optionTitle || !mappings || typeof mappings !== "object") return null;

  for (const [optionValue, urls] of Object.entries(mappings)) {
    if (Array.isArray(urls) && urls.includes(url)) {
      return { optionTitle, optionValue };
    }
  }
  return null;
}
