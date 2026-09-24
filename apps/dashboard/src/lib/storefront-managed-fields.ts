/**
 * Storefront values owned by Settings > Shop rather than a design revision.
 *
 * Templates may expose these paths for rendering and localization metadata,
 * but the visual editor must never create a second source of truth for them.
 */
export const SHOP_MANAGED_STOREFRONT_PATHS = new Set([
  "footer.address",
  "footer.blurb",
  "footer.email",
  "footer.phone",
  "footer.socialLinks",
]);

export function isShopManagedStorefrontPath(path: string) {
  return SHOP_MANAGED_STOREFRONT_PATHS.has(path);
}
