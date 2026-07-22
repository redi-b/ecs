/**
 * Maps platform API error codes to merchant-safe dashboard copy.
 *
 * Contract:
 * - Platform API clients should keep machine codes in `message` / `error` so
 *   list-error helpers and mutation handlers can branch on codes.
 * - Map to human text only at the presentation boundary (pages, toasts, alerts).
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
  commerce_backend_unavailable: "Commerce data is temporarily unavailable. Try again.",
  commerce_credentials_invalid: "Commerce data is temporarily unavailable. Contact support.",
  commerce_credentials_missing: "Commerce data is temporarily unavailable. Contact support.",
  commerce_store_unavailable: "Shop commerce setup is incomplete.",
  commerce_sales_channel_unavailable: "Shop commerce setup is incomplete.",
  commerce_region_unavailable: "Shop commerce setup is incomplete.",
  inventory_location_unavailable: "Stock location is not ready for this shop.",
  product_not_found: "This product could not be found.",
  product_write_invalid: "Check the product details and try again.",
  product_conflict: "A product with this handle already exists.",
  product_variant_unsupported: "Variant stock is not available for this product yet.",
  product_inventory_unavailable: "Stock data is temporarily unavailable. Try again.",
  category_not_found: "This category could not be found.",
  category_write_invalid: "Check the category details and try again.",
  category_conflict: "A category with this handle already exists.",
  collection_not_found: "This collection could not be found.",
  collection_write_invalid: "Check the collection details and try again.",
  collection_conflict: "A collection with this handle already exists.",
  invalid_customer_address: "Check the address details and try again.",
  customer_address_not_found: "This address could not be found.",
  order_not_found: "This order could not be found.",
  order_fulfillment_not_found: "This fulfillment could not be found.",
  order_action_invalid: "That order action is not available.",
  invalid_manual_order: "Check customer email and line items, then try again.",
  draft_order_unavailable: "Manual orders are not available yet. Contact support.",
  manual_order_convert_failed: "The order draft could not be finalized. Try again.",
  manual_order_create_failed: "Could not create this order. Try again.",
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
  fulfillment_method_required: "Keep at least delivery or pickup enabled for checkout.",
  invalid_delivery_settings: "Check fulfillment settings and try again.",
  invalid_promotion: "Check the promotion details and try again.",
  promotion_max_quantity_required:
    "Set a max quantity per item when the discount applies to each item.",
  promotion_currency_required: "A currency is required for fixed-amount promotions.",
  promotion_code_taken: "That promotion code is already in use.",
  promotion_not_found: "This promotion could not be found.",
  promotion_create_failed: "Could not create this promotion. Try again.",
  payments_unavailable: "Payment settings are temporarily unavailable.",
  missing_secret_key: "Enter your Chapa secret key.",
  missing_online_enabled: "Choose whether online payments should be on or off.",
  chapa_credentials_invalid: "Chapa rejected this key. Check the secret and try again.",
  encryption_unavailable: "Could not store payment credentials securely. Contact support.",
  merchant_chapa_not_configured: "Online payments are not set up for this shop yet.",
  chapa_payment_not_paid: "Payment is not complete yet.",
  chapa_payment_not_found: "This payment could not be found.",
  chapa_verification_failed: "Payment could not be verified. Try again.",
  chapa_tx_ref_missing: "Payment reference is missing. Start checkout again.",
  chapa_tx_ref_mismatch: "Payment reference did not match this cart.",
  notifications_unavailable: "Notification settings are temporarily unavailable.",
  not_found: "That item could not be found.",
  notification_preference_missing:
    "Save your notification settings before sending a test.",
  notification_channel_invalid: "Choose a valid notification channel.",
  telegram_not_configured: "Telegram alerts are not available for this shop right now.",
  telegram_operator_forbidden: "Only owners and managers can enable Telegram shop tools.",
  binding_not_found: "That Telegram shop tools link was not found.",
  email_not_configured: "Email alerts are not available for this shop right now.",
  telegram_destination_limit: "You can connect up to 10 Telegram accounts per shop.",
  session_not_found: "That connect link expired. Connect Telegram again.",
  destination_not_found: "That Telegram account is no longer connected.",
  billing_not_found: "Billing is not active for this shop yet.",
  billing_unavailable: "Billing is temporarily unavailable.",
  billing_plan_required: "Choose a plan to continue.",
  billing_plan_not_found: "That plan is not available.",
  billing_plan_is_free: "Free plans do not use payment invoices.",
  billing_plan_not_free: "Only free plans can be scheduled as a downgrade.",
  billing_not_on_paid_plan: "You are already on a free plan.",
  billing_no_scheduled_downgrade: "There is no scheduled plan change to cancel.",
  billing_already_on_plan: "You already have an active period on this plan.",
  billing_downgrade_failed: "Could not schedule the plan change.",
  billing_cancel_downgrade_failed: "Could not cancel the scheduled plan change.",
  billing_invoice_required: "Choose an invoice to pay.",
  billing_invoice_not_found: "Invoice not found.",
  billing_invoice_not_payable: "This invoice cannot be paid.",
  billing_invoice_is_free: "Free invoices cannot be paid with Chapa.",
  billing_chapa_unavailable: "Card payments are not configured yet.",
  billing_chapa_init_failed: "Could not start Chapa checkout. Try again.",
  billing_payer_email_required:
    "A valid email is required for payment. For local demo shops, set CHAPA_FALLBACK_EMAIL in platform-api/.env.",
  billing_upgrade_failed: "Could not create the upgrade invoice.",
  billing_pay_failed: "Could not start payment.",
  billing_return_url_required: "Missing return URL for payment.",
  template_not_found: "That storefront template could not be found.",
  template_plan_unavailable: "That storefront template is not available on this plan.",
  tenant_not_found: "This shop could not be found.",
  platform_request_failed: "The request could not be completed. Try again.",
  invalid_orders_response: "Order data was incomplete. Try again.",
  invalid_order_response: "Order data was incomplete. Try again.",
  invalid_products_response: "Product data was incomplete. Try again.",
  invalid_product_response: "Product data was incomplete. Try again.",
  customer_not_found: "This customer could not be found.",
  customer_email_conflict: "Another customer already uses this email.",
  invalid_customer: "Check the customer details and try again.",
  customer_request_failed: "Customer data is temporarily unavailable. Try again.",
  promotion_update_failed: "Could not update this promotion. Try again.",
  promotion_delete_failed: "Could not delete this promotion. Try again.",
  media_list_failed: "Media library is temporarily unavailable. Try again.",
  media_storage_unavailable: "Media storage is not available right now.",
  media_asset_not_found: "That media file could not be found.",
  invalid_media_list_response: "Media data was incomplete. Try again.",
  invalid_media_asset: "That media file could not be processed.",
  media_upload_not_found: "Upload did not finish. Try again.",
  media_object_mismatch: "Uploaded file did not match what was expected.",
  media_asset_in_use: "This file is still used by a product and cannot be deleted.",
  network: "Network error. Check your connection and try again.",
};

/** Read `{ error }` from a failed platform/action response and map to merchant copy. */
export async function readPlatformErrorMessage(
  response: Response | null,
  options: PlatformErrorMessageOptions = {},
) {
  if (!response) {
    return mapPlatformErrorMessage("network", options);
  }

  const data = (await response
    .clone()
    .json()
    .catch(() => null)) as { error?: unknown; message?: unknown } | null;
  const code =
    typeof data?.error === "string"
      ? data.error
      : typeof data?.message === "string"
        ? data.message
        : null;

  return mapPlatformErrorMessage(code, options);
}

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

  // Unknown snake_case codes should not be shown raw to merchants.
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
