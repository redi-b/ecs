import type { StorefrontLocale } from "@ecs/contracts";
import * as m from "../../paraglide/messages.js";

/**
 * Map platform/store error codes and raw API text to customer-facing copy.
 * Never surface raw codes like shop_unpublished on the storefront.
 */
export function customerFacingStoreError(
  message: string | null | undefined,
  locale: StorefrontLocale = "en",
): string {
  const raw = (message ?? "").trim();
  const key = raw.toLowerCase().replace(/\s+/g, "_");

  const map: Record<string, () => string> = {
    shop_unpublished: () => m.status_shop_closed_help({}, { locale }),
    shop_not_found: () => m.status_shop_not_found({}, { locale }),
    shop_suspended: () => m.status_shop_closed_help({}, { locale }),
    shop_context_required: () => m.status_shop_unavailable({}, { locale }),
    domain_misconfigured: () => m.status_shop_unavailable({}, { locale }),
    commerce_region_unavailable: () => m.checkout_options_unavailable({}, { locale }),
    commerce_backend_unavailable: () => m.status_generic_error({}, { locale }),
    product_not_found: () => m.product_unavailable({}, { locale }),
    cart_not_found: () => m.cart_not_found({}, { locale }),
    cart_items_unavailable: () => m.cart_items_changed({}, { locale }),
    store_route_not_allowed: () => m.status_not_found_help({}, { locale }),
    invalid_storefront_config_response: () => m.status_try_again_later({}, { locale }),
    config_request_failed: () => m.status_try_again_later({}, { locale }),
    invalid_customer_credentials: () => m.account_sign_in_failed({}, { locale }),
    invalid_customer_registration: () => m.account_register_failed({}, { locale }),
    customer_account_exists: () => m.account_register_failed({}, { locale }),
    customer_registration_failed: () => m.account_register_failed({}, { locale }),
    customer_login_failed: () => m.account_sign_in_failed({}, { locale }),
    customer_auth_required: () => m.status_access_help({}, { locale }),
    customer_session_invalid: () => m.status_access_help({}, { locale }),
    customer_orders_unavailable: () => m.checkout_orders_unavailable({}, { locale }),
    invalid_customer_profile: () => m.account_save_failed({}, { locale }),
    customer_profile_update_failed: () => m.account_save_failed({}, { locale }),
    customer_order_not_found: () => m.account_order_not_found({}, { locale }),
  };

  if (key && map[key]) {
    return map[key]();
  }

  if (/inventory|stock|available quantity/i.test(raw)) {
    return m.cart_items_changed({}, { locale });
  }
  return m.status_generic_error({}, { locale });
}
