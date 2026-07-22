export type UpdateTenantShippingPriceResult =
  | { ok: true }
  | { ok: false; error: "commerce_backend_unavailable" | "invalid_shipping_price_update" };

type UpdateTenantShippingPriceClientOptions = {
  fetch?: typeof fetch;
  internalApiToken: string | undefined;
  medusaInternalUrl: string;
};

/**
 * Updates the flat-rate amount on a tenant's Medusa shipping option so checkout
 * charges match Settings → Fulfillment → default delivery fee.
 */
export function createMedusaShippingPriceClient(
  options: UpdateTenantShippingPriceClientOptions,
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
