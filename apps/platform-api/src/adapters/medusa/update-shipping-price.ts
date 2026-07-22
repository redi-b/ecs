export type UpdateTenantShippingPriceResult =
  | { ok: true }
  | { ok: false; error: "commerce_backend_unavailable" | "invalid_shipping_price_update" };

export type EnsurePickupOptionResult =
  | { ok: true; pickupOptionId: string; created: boolean }
  | { ok: false; error: "commerce_backend_unavailable" | "invalid_ensure_pickup" };

type MedusaFulfillmentOptionClientOptions = {
  fetch?: typeof fetch;
  internalApiToken: string | undefined;
  medusaInternalUrl: string;
};

/**
 * Updates the flat-rate amount on a tenant's Medusa shipping option so checkout
 * charges match Settings → Fulfillment → default delivery fee.
 */
export function createMedusaShippingPriceClient(
  options: MedusaFulfillmentOptionClientOptions,
) {
  const medusaInternalUrl = options.medusaInternalUrl.replace(/\/$/, "");
  const fetchImplementation = options.fetch ?? fetch;

  return async function updateTenantShippingPrice(input: {
    amount: number;
    currencyCode: string;
    shippingOptionId: string;
  }): Promise<UpdateTenantShippingPriceResult> {
    if (!options.internalApiToken) {
      return { ok: false, error: "commerce_backend_unavailable" };
    }

    if (
      !input.shippingOptionId.trim() ||
      !input.currencyCode.trim() ||
      !Number.isFinite(input.amount) ||
      input.amount < 0
    ) {
      return { ok: false, error: "invalid_shipping_price_update" };
    }

    try {
      const response = await fetchImplementation(
        `${medusaInternalUrl}/internal/platform/update-shipping-price`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: input.amount,
            currencyCode: input.currencyCode.trim().toLowerCase(),
            shippingOptionId: input.shippingOptionId.trim(),
          }),
          headers: {
            "content-type": "application/json",
            "x-platform-internal-token": options.internalApiToken,
          },
        },
      );

      if (!response.ok) {
        return { ok: false, error: "commerce_backend_unavailable" };
      }

      return { ok: true };
    } catch {
      return { ok: false, error: "commerce_backend_unavailable" };
    }
  };
}

/** Creates free Store Pickup option when the shop only has a paid delivery rate. */
export function createMedusaEnsurePickupOptionClient(
  options: MedusaFulfillmentOptionClientOptions,
) {
  const medusaInternalUrl = options.medusaInternalUrl.replace(/\/$/, "");
  const fetchImplementation = options.fetch ?? fetch;

  return async function ensureTenantPickupOption(input: {
    currencyCode: string;
    deliveryShippingOptionId: string;
  }): Promise<EnsurePickupOptionResult> {
    if (!options.internalApiToken) {
      return { ok: false, error: "commerce_backend_unavailable" };
    }
    if (!input.deliveryShippingOptionId.trim()) {
      return { ok: false, error: "invalid_ensure_pickup" };
    }

    try {
      const response = await fetchImplementation(
        `${medusaInternalUrl}/internal/platform/ensure-pickup-option`,
        {
          method: "POST",
          body: JSON.stringify({
            currencyCode: input.currencyCode.trim().toLowerCase() || "etb",
            deliveryShippingOptionId: input.deliveryShippingOptionId.trim(),
          }),
          headers: {
            "content-type": "application/json",
            "x-platform-internal-token": options.internalApiToken,
          },
        },
      );

      if (!response.ok) {
        return { ok: false, error: "commerce_backend_unavailable" };
      }

      const data = (await response.json().catch(() => null)) as {
        pickupOptionId?: string;
        created?: boolean;
      } | null;

      if (!data?.pickupOptionId) {
        return { ok: false, error: "commerce_backend_unavailable" };
      }

      return {
        ok: true,
        pickupOptionId: data.pickupOptionId,
        created: Boolean(data.created),
      };
    } catch {
      return { ok: false, error: "commerce_backend_unavailable" };
    }
  };
}
