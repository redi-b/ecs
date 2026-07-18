/**
 * Map platform/store error codes and raw API text to customer-facing copy.
 * Never surface raw codes like shop_unpublished on the storefront.
 */
export function customerFacingStoreError(message: string | null | undefined): string {
  const raw = (message ?? "").trim();
  const key = raw.toLowerCase().replace(/\s+/g, "_");

  const map: Record<string, string> = {
    shop_unpublished: "This shop is temporarily unavailable.",
    shop_not_found: "We could not find this shop.",
    shop_suspended: "This shop is not accepting orders right now.",
    shop_context_required: "This shop is not available from this address.",
    domain_misconfigured: "This shop is not fully set up yet. Please check back soon.",
    commerce_region_unavailable: "This shop is not ready for checkout yet.",
    commerce_backend_unavailable: "Something went wrong loading the shop. Please try again.",
    product_not_found: "This product is unavailable or does not exist.",
    cart_not_found: "Your cart could not be found. Add items again to continue.",
    store_route_not_allowed: "That request is not available.",
    invalid_storefront_config_response: "This shop could not be loaded. Please try again later.",
    config_request_failed: "This shop could not be loaded. Please try again later.",
  };

  if (key && map[key]) {
    return map[key];
  }

  // Already human-readable sentences (from our own redirects)
  if (raw && !/^[a-z0-9_]+$/i.test(raw) && raw.includes(" ")) {
    return raw;
  }

  if (raw && map[raw]) {
    return map[raw];
  }

  return "Something went wrong. Please try again.";
}
