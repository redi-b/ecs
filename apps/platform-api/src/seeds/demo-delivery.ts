import type { createMedusaShippingPriceClient } from "../adapters/medusa/update-shipping-price.js";

export const DEMO_DELIVERY_FEE = 75;

/** Synchronize commerce first; never publish a demo delivery fee checkout cannot charge. */
export async function syncDemoDeliveryPrice(
  shippingOptionId: string | null | undefined,
  updatePrice: ReturnType<typeof createMedusaShippingPriceClient>,
) {
  if (!shippingOptionId?.trim()) {
    throw new Error("Demo delivery price sync failed: missing shipping option");
  }
  const result = await updatePrice({
    shippingOptionId,
    amount: DEMO_DELIVERY_FEE,
    currencyCode: "etb",
  });
  if (!result.ok) {
    throw new Error(`Demo delivery price sync failed: ${result.error}`);
  }
}
