/**
 * Static template registry. Keys must match platform `template_key` values.
 * Never load template modules from merchant or database input.
 *
 * ## Adding a template
 * 1. Create `src/templates/<name>/v1/` with Astro page slots (Home required).
 * 2. Add schema/defaults under `packages/storefront-templates`.
 * 3. Register `"name@1"` below (point optional slots at custom pages or omit → fallback).
 * 4. Sync templates to platform DB.
 *
 * Missing optional slots fall back to `templates/fallback/*` (shared functional UI).
 *
 * @see dev-docs/post-mvp/14-storefront-completeness-and-templates-plan.md
 * @see templates/README.md
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
 * classic@1 — default complete storefront.
 * Commerce slots use the shared polished fallbacks (design system in commerce.css).
 * Premium templates override only the slots they redesign.
 */
export const storefrontRenderers: Record<string, StorefrontRenderer> = {
  "classic@1": {
    Home: ClassicV1Home,
    ProductList: FallbackProductListPage,
    Product: FallbackProductPage,
    Cart: FallbackCartPage,
    Checkout: FallbackCheckoutPage,
    OrderConfirm: FallbackOrderConfirmPage,
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
