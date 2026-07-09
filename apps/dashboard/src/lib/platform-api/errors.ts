/**
 * Maps platform API error codes to merchant-safe dashboard messages.
 * Keep this as the single place for production copy used by server clients.
 */

export type PlatformErrorMessageOptions = {
  fallback?: string;
  resource?: string;
};

const PLATFORM_ERROR_MESSAGES: Record<string, string> = {
  auth_required: "Sign in to continue.",
  dashboard_forbidden: "You do not have access to this shop.",
  shop_context_required: "Open this page from your shop dashboard.",
  shop_not_found: "This shop could not be found.",
  shop_unpublished: "This shop is not published yet.",
  shop_suspended: "This shop is currently suspended.",
  domain_misconfigured: "This shop domain is not ready yet.",
  commerce_backend_unavailable: "Catalog data is temporarily unavailable. Try again.",
  commerce_credentials_invalid: "Catalog data is temporarily unavailable. Contact support.",
  commerce_credentials_missing: "Catalog data is temporarily unavailable. Contact support.",
  commerce_store_unavailable: "Shop commerce setup is incomplete.",
  commerce_sales_channel_unavailable: "Shop commerce setup is incomplete.",
  commerce_region_unavailable: "Shop commerce setup is incomplete.",
  inventory_location_unavailable: "Stock location is not ready for this shop.",
  product_not_found: "This product could not be found.",
  product_variant_unsupported: "Variant stock is not available for this product yet.",
  product_inventory_unavailable: "Stock data is temporarily unavailable. Try again.",
  order_not_found: "This order could not be found.",
  order_fulfillment_not_found: "This fulfillment could not be found.",
  order_action_invalid: "That order action is not available.",
  missing_title: "A title is required.",
  missing_name: "A name is required.",
  missing_handle: "A handle is required.",
  missing_channel: "A notification channel is required.",
  missing_target: "A notification target is required.",
  invalid_stocked_quantity: "Enter a valid stock quantity.",
  invalid_product_ids: "Select at least one product.",
  invalid_category_ids: "Select at least one category.",
  invalid_collection_ids: "Select at least one collection.",
  settings_unavailable: "Shop settings are temporarily unavailable.",
  notifications_unavailable: "Notification settings are temporarily unavailable.",
  billing_not_found: "Billing is not active for this shop yet.",
  billing_unavailable: "Billing is temporarily unavailable.",
  template_not_found: "That storefront template could not be found.",
  template_plan_unavailable: "That storefront template is not available on this plan.",
  tenant_not_found: "This shop could not be found.",
  platform_request_failed: "The request could not be completed. Try again.",
  invalid_orders_response: "Order data was incomplete. Try again.",
  invalid_order_response: "Order data was incomplete. Try again.",
  invalid_products_response: "Product data was incomplete. Try again.",
  invalid_product_response: "Product data was incomplete. Try again.",
  network: "Network error. Check your connection and try again.",
};

export function mapPlatformErrorMessage(
  error: string | null | undefined,
  options: PlatformErrorMessageOptions = {},
) {
  const code = error?.trim();
  if (!code) {
    return options.fallback ?? defaultFallback(options.resource);
  }

  const mapped = PLATFORM_ERROR_MESSAGES[code];
  if (mapped) {
    return mapped;
  }

  // Never surface raw developer codes as primary copy when unknown.
  if (/^[a-z0-9_]+$/i.test(code) && code.includes("_")) {
    return options.fallback ?? defaultFallback(options.resource);
  }

  return code;
}

function defaultFallback(resource?: string) {
  if (resource) {
    return `${resource} is temporarily unavailable. Try again.`;
  }

  return "Something went wrong. Try again.";
}

export function isKnownPlatformErrorCode(error: string | null | undefined) {
  return Boolean(error && PLATFORM_ERROR_MESSAGES[error]);
}
