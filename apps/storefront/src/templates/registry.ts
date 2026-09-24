/**
 * Static template registry. Keys must match platform `template_key` values.
 * Never load template modules from merchant or database input.
 *
 * Missing optional slots fall back to `templates/fallback/*`.
 */
import type { StorefrontTemplateKey } from "@ecs/storefront-templates";
import FallbackCartPage from "./fallback/CartPage.astro";
import FallbackCheckoutPage from "./fallback/CheckoutPage.astro";
import FallbackOrderConfirmPage from "./fallback/OrderConfirmPage.astro";
import FallbackProductListPage from "./fallback/ProductListPage.astro";
import FallbackProductPage from "./fallback/ProductPage.astro";
import AfroV1Home from "./afro/v1/pages/index.astro";
import AfroV1Cart from "./afro/v1/pages/Cart.astro";
import AfroV1Checkout from "./afro/v1/pages/Checkout.astro";
import AfroV1OrderConfirm from "./afro/v1/pages/OrderConfirm.astro";
import AfroV1PaymentReturn from "./afro/v1/pages/PaymentReturn.astro";
import AfroV1Contact from "./afro/v1/pages/Contact.astro";
import AfroV1RequestItem from "./afro/v1/pages/RequestItem.astro";
import AfroV1Wishlist from "./afro/v1/pages/Wishlist.astro";
import AfroV1Account from "./afro/v1/pages/Account.astro";
import AfroV1AccountOrder from "./afro/v1/pages/AccountOrder.astro";
import AfroV1SystemState from "./afro/v1/pages/SystemState.astro";
import AfroV1Product from "./afro/v1/pages/Product.astro";
import AfroV1ProductList from "./afro/v1/pages/ProductList.astro";
import NexahubV1Home from "./nexahub/v1/pages/index.astro";
import NexahubV1Cart from "./nexahub/v1/pages/Cart.astro";
import NexahubV1Checkout from "./nexahub/v1/pages/Checkout.astro";
import NexahubV1OrderConfirm from "./nexahub/v1/pages/OrderConfirm.astro";
import NexahubV1PaymentReturn from "./nexahub/v1/pages/PaymentReturn.astro";
import NexahubV1Contact from "./nexahub/v1/pages/Contact.astro";
import NexahubV1RequestItem from "./nexahub/v1/pages/RequestItem.astro";
import NexahubV1Wishlist from "./nexahub/v1/pages/Wishlist.astro";
import NexahubV1Account from "./nexahub/v1/pages/Account.astro";
import NexahubV1AccountOrder from "./nexahub/v1/pages/AccountOrder.astro";
import NexahubV1SystemState from "./nexahub/v1/pages/SystemState.astro";
import NexahubV1Product from "./nexahub/v1/pages/Product.astro";
import NexahubV1ProductList from "./nexahub/v1/pages/ProductList.astro";
import LuviaV1Account from "./luvia/v1/pages/Account.astro";
import LuviaV1AccountOrder from "./luvia/v1/pages/AccountOrder.astro";
import LuviaV1Cart from "./luvia/v1/pages/Cart.astro";
import LuviaV1Checkout from "./luvia/v1/pages/Checkout.astro";
import LuviaV1Contact from "./luvia/v1/pages/Contact.astro";
import LuviaV1Home from "./luvia/v1/pages/index.astro";
import LuviaV1OrderConfirm from "./luvia/v1/pages/OrderConfirm.astro";
import LuviaV1Product from "./luvia/v1/pages/Product.astro";
import LuviaV1ProductList from "./luvia/v1/pages/ProductList.astro";
import LuviaV1RequestItem from "./luvia/v1/pages/RequestItem.astro";
import LuviaV1SystemState from "./luvia/v1/pages/SystemState.astro";
import LuviaV1Wishlist from "./luvia/v1/pages/Wishlist.astro";
import { resolveStorefrontTemplateKey } from "./template-key.js";
import type { StorefrontPageComponent, StorefrontRenderer } from "./types.js";

const fallbacks = {
  ProductList: FallbackProductListPage,
  Product: FallbackProductPage,
  Cart: FallbackCartPage,
  Checkout: FallbackCheckoutPage,
  OrderConfirm: FallbackOrderConfirmPage,
} as const;

export const storefrontRenderers = {
  "afro@1": {
    Home: AfroV1Home,
    ProductList: AfroV1ProductList,
    Product: AfroV1Product,
    Cart: AfroV1Cart,
    Checkout: AfroV1Checkout,
    PaymentReturn: AfroV1PaymentReturn,
    OrderConfirm: AfroV1OrderConfirm,
    Contact: AfroV1Contact,
    RequestItem: AfroV1RequestItem,
    Wishlist: AfroV1Wishlist,
    Account: AfroV1Account,
    AccountOrder: AfroV1AccountOrder,
    SystemState: AfroV1SystemState,
  },
  "luvia@1": {
    Home: LuviaV1Home,
    ProductList: LuviaV1ProductList,
    Product: LuviaV1Product,
    Cart: LuviaV1Cart,
    Checkout: LuviaV1Checkout,
    Contact: LuviaV1Contact,
    OrderConfirm: LuviaV1OrderConfirm,
    RequestItem: LuviaV1RequestItem,
    Wishlist: LuviaV1Wishlist,
    Account: LuviaV1Account,
    AccountOrder: LuviaV1AccountOrder,
    SystemState: LuviaV1SystemState,
  },
  "nexahub@1": {
    Home: NexahubV1Home,
    ProductList: NexahubV1ProductList,
    Product: NexahubV1Product,
    Cart: NexahubV1Cart,
    Checkout: NexahubV1Checkout,
    PaymentReturn: NexahubV1PaymentReturn,
    OrderConfirm: NexahubV1OrderConfirm,
    Contact: NexahubV1Contact,
    RequestItem: NexahubV1RequestItem,
    Wishlist: NexahubV1Wishlist,
    Account: NexahubV1Account,
    AccountOrder: NexahubV1AccountOrder,
    SystemState: NexahubV1SystemState,
  },
} satisfies Record<StorefrontTemplateKey, StorefrontRenderer>;

export function getStorefrontRenderer(templateKey: string): StorefrontRenderer | undefined {
  return storefrontRenderers[resolveStorefrontTemplateKey(templateKey) as StorefrontTemplateKey];
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
