export const STOREFRONT_PREVIEW_PAGE_IDS = ["home", "products"] as const;
export type StorefrontPreviewPageId = (typeof STOREFRONT_PREVIEW_PAGE_IDS)[number];

export function parseStorefrontPreviewPageId(value: string | null): StorefrontPreviewPageId | null {
  const pageId = value?.trim() || "home";
  return STOREFRONT_PREVIEW_PAGE_IDS.includes(pageId as StorefrontPreviewPageId)
    ? (pageId as StorefrontPreviewPageId)
    : null;
}
