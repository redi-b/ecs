/**
 * Static template registry. Keys must match platform `template_key` values.
 * Never load template modules from merchant or database input.
 *
 * @see dev-docs/post-mvp/14-storefront-completeness-and-templates-plan.md
 */
import ClassicV1Home from "./classic/v1/Home.astro";
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

/**
 * classic@1 currently supplies Home only; commerce pages use shared fallbacks
 * until template-specific Astro pages are registered.
 */
export const storefrontRenderers: Record<string, StorefrontRenderer> = {
  "classic@1": {
    Home: ClassicV1Home,
    ...fallbacks,
  },
};

export function getStorefrontRenderer(templateKey: string): StorefrontRenderer | undefined {
  return storefrontRenderers[templateKey];
}

/** Resolve a page slot with shared functional fallback. */
export function resolveRendererSlot<K extends keyof typeof fallbacks>(
  templateKey: string | undefined,
  slot: K,
) {
  const renderer = templateKey ? getStorefrontRenderer(templateKey) : undefined;
  const fromTemplate = renderer?.[slot];
  return (fromTemplate ?? fallbacks[slot]) as (typeof fallbacks)[K];
}

export { fallbacks as storefrontFallbackPages };
