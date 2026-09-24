import type { StoreCart, StoreCartPromotion } from "./types.js";

export type StoreCartSummary = {
  itemCount: number;
  subtotal: number | null;
  discountTotal: number | null;
  shippingTotal: number | null;
  shippingDiscountTotal: number | null;
  taxTotal: number | null;
  total: number | null;
  savingsTotal: number | null;
  appliedCodes: StoreCartPromotion[];
  automaticPromotions: StoreCartPromotion[];
};

/**
 * One template-neutral interpretation of Medusa's authoritative cart totals.
 * Templates render these values but never infer promotion eligibility or recalculate totals.
 */
export function resolveStoreCartSummary(cart: StoreCart | null): StoreCartSummary {
  const promotions = cart?.promotions ?? [];
  const discountTotal = cart?.discountTotal ?? null;
  const shippingDiscountTotal = cart?.shippingDiscountTotal ?? null;
  const savingsTotal =
    discountTotal != null
      ? Math.max(0, discountTotal)
      : cart?.itemDiscountTotal != null || shippingDiscountTotal != null
        ? Math.max(0, (cart?.itemDiscountTotal ?? 0) + (shippingDiscountTotal ?? 0))
      : cart?.originalTotal != null && cart.total != null
        ? Math.max(0, cart.originalTotal - cart.total)
        : null;

  return {
    itemCount: (cart?.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    subtotal: cart?.subtotal ?? cart?.itemSubtotal ?? cart?.itemTotal ?? cart?.total ?? null,
    discountTotal,
    shippingTotal: cart?.shippingTotal ?? null,
    shippingDiscountTotal,
    taxTotal: cart?.taxTotal ?? null,
    total: cart?.total ?? cart?.itemTotal ?? null,
    savingsTotal,
    appliedCodes: promotions.filter((promotion) => !promotion.isAutomatic && Boolean(promotion.code)),
    automaticPromotions: promotions.filter((promotion) => promotion.isAutomatic),
  };
}
