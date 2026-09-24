import type { StoreDeliveryOptions, StoreShippingOption } from "./types.js";

const PICKUP_NAME = /pickup|collect/i;

export function resolveStoreFulfillmentOptions(
  shippingOptions: StoreShippingOption[],
  delivery: StoreDeliveryOptions | null,
) {
  const pickupOptions = shippingOptions.filter(
    (option) => option.amount === 0 || PICKUP_NAME.test(option.name ?? ""),
  );
  const deliveryOptions = shippingOptions.filter(
    (option) => option.amount !== 0 && !PICKUP_NAME.test(option.name ?? ""),
  );
  const configuredFee = Number(delivery?.defaultDeliveryFee);
  const priceMismatch =
    delivery?.deliveryEnabled === true &&
    Number.isFinite(configuredFee) &&
    deliveryOptions.length > 0 &&
    !deliveryOptions.some(
      (option) => option.amount != null && Math.abs(option.amount - configuredFee) < 0.005,
    );

  return {
    deliveryOptions,
    pickupOption: pickupOptions[0] ?? null,
    priceMismatch,
  };
}
