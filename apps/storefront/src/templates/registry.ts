/**
 * Static template registry. Keys must match platform `template_key` values.
 * Never load template modules from merchant or database input.
 *
 * Missing optional slots fall back to `templates/fallback/*`.
 */
import type { StorefrontTemplateKey } from "@ecs/storefront-templates";
import LuviaV1Home from "./luvia/v1/Home.astro";
import LuviaV1ProductList from "./luvia/v1/ProductList.astro";
import LuviaV1Product from "./luvia/v1/Product.astro";
import LuviaV1Cart from "./luvia/v1/Cart.astro";
import LuviaV1Checkout from "./luvia/v1/Checkout.astro";
import LuviaV1Contact from "./luvia/v1/Contact.astro";
import LuviaV1OrderConfirm from "./luvia/v1/OrderConfirm.astro";
import LuviaV1About from "./luvia/v1/About.astro";
import LuviaV1RequestItem from "./luvia/v1/RequestItem.astro";
import LuviaV1Wishlist from "./luvia/v1/Wishlist.astro";
import LuviaV1Account from "./luvia/v1/Account.astro";
import FallbackCartPage from "./fallback/CartPage.astro";
import FallbackCheckoutPage from "./fallback/CheckoutPage.astro";
import FallbackOrderConfirmPage from "./fallback/OrderConfirmPage.astro";
import FallbackProductListPage from "./fallback/ProductListPage.astro";
import FallbackProductPage from "./fallback/ProductPage.astro";
import type { StorefrontPageComponent, StorefrontRenderer } from "./types.js";

const fallbacks = {
  ProductList: FallbackProductListPage,
  Product: FallbackProductPage,
  Cart: FallbackCartPage,
  Checkout: FallbackCheckoutPage,
  OrderConfirm: FallbackOrderConfirmPage,
} as const;

export const storefrontRenderers = {
  "luvia@1": {
    Home: LuviaV1Home,
    ProductList: LuviaV1ProductList,
    Product: LuviaV1Product,
    Cart: LuviaV1Cart,
    Checkout: LuviaV1Checkout,
    Contact: LuviaV1Contact,
    OrderConfirm: LuviaV1OrderConfirm,
    About: LuviaV1About,
    RequestItem: LuviaV1RequestItem,
    Wishlist: LuviaV1Wishlist,
    Account: LuviaV1Account,
  },
} satisfies Record<StorefrontTemplateKey, StorefrontRenderer>;

export function getStorefrontRenderer(templateKey: string): StorefrontRenderer | undefined {
  return storefrontRenderers[templateKey as StorefrontTemplateKey];
}

export function resolveRendererSlot<K extends keyof typeof fallbacks>(
  templateKey: string | undefined,
  slot: K,
) {
  const renderer = templateKey ? getStorefrontRenderer(templateKey) : undefined;
  const fromTemplate = renderer?.[slot];
  return (fromTemplate ?? fallbacks[slot]) as StorefrontPageComponent;
}

export { fallbacks as storefrontFallbackPages };
