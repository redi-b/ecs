/**
 * Backward-compatible re-exports. Prefer `@/lib/commerce` imports for new code.
 * (Storefront uses relative imports under src/lib.)
 */
export {
  createStoreCart,
  getStoreDeliveryOptions,
  listStoreProducts,
  type StoreCart,
  type StoreCartResponse,
  type StoreDeliveryOptions,
  type StoreDeliveryOptionsResponse,
  type StorefrontError,
  type StorefrontFetch,
  type StoreProduct,
  type StoreProductsResponse,
} from "./commerce/index.js";
