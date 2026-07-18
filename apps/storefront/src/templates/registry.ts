/**
 * Static template registry. Keys must match platform `template_key` values.
 * Never load template modules from merchant or database input.
 *
 * classic@1 is the default complete storefront (premium dark design system).
 * Missing optional slots fall back to `templates/fallback/*`.
 */
import ClassicV1Cart from "./classic/v1/Cart.astro";
import ClassicV1Checkout from "./classic/v1/Checkout.astro";
import ClassicV1Home from "./classic/v1/Home.astro";
import ClassicV1OrderConfirm from "./classic/v1/OrderConfirm.astro";
import ClassicV1Product from "./classic/v1/Product.astro";
import ClassicV1ProductList from "./classic/v1/ProductList.astro";
import FallbackCartPage from "./fallback/CartPage.astro";
import FallbackCheckoutPage from "./fallback/CheckoutPage.astro";
import FallbackOrderConfirmPage from "./fallback/OrderConfirmPage.astro";
import FallbackProductListPage from "./fallback/ProductListPage.astro";
import FallbackProductPage from "./fallback/ProductPage.astro";
import type { StorefrontRenderer } from "./types.js";

const fallbacks = {
  ProductList: FallbackProductListPage,
  Product: FallbackProductPage,
  Cart: FallbackCartPage,
  Checkout: FallbackCheckoutPage,
  OrderConfirm: FallbackOrderConfirmPage,
} as const;

export const storefrontRenderers: Record<string, StorefrontRenderer> = {
  "classic@1": {
    Home: ClassicV1Home,
    ProductList: ClassicV1ProductList,
    Product: ClassicV1Product,
    Cart: ClassicV1Cart,
    Checkout: ClassicV1Checkout,
    OrderConfirm: ClassicV1OrderConfirm,
  },
};

export function getStorefrontRenderer(templateKey: string): StorefrontRenderer | undefined {
  return storefrontRenderers[templateKey];
}

export function resolveRendererSlot<K extends keyof typeof fallbacks>(
  templateKey: string | undefined,
  slot: K,
) {
  const renderer = templateKey ? getStorefrontRenderer(templateKey) : undefined;
  const fromTemplate = renderer?.[slot];
  return (fromTemplate ?? fallbacks[slot]) as (typeof fallbacks)[K];
}

export { fallbacks as storefrontFallbackPages };
