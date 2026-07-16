export type CommerceProvisioningInput = {
  handle: string;
  name: string;
  platformTenantId: string;
  requestedByUserId: string;
};

export type CommerceProvisioningResult =
  | {
      ok: true;
      resources: {
        storeId: string;
        salesChannelId: string;
        stockLocationId: string;
        publishableKeyId: string;
        regionId: string;
        shippingProfileId: string;
        fulfillmentSetId: string;
        serviceZoneId: string;
        shippingOptionId: string;
      };
    }
  | {
      ok: false;
      error: "commerce_backend_unavailable";
    };

type MedusaCommerceProvisioningClientOptions = {
  fetch?: typeof fetch;
  internalApiToken: string | undefined;
  medusaInternalUrl: string;
};

/** Medusa Store API x-publishable-api-key value: token (pk_…), not row id (apk_…). */
export function isPublishableStoreToken(value: string): boolean {
  const token = value.trim();
  return token.startsWith("pk_") && token.length > 3 && !token.startsWith("apk_");
}

export function createMedusaCommerceProvisioningClient(
  options: MedusaCommerceProvisioningClientOptions,
) {
  const medusaInternalUrl = options.medusaInternalUrl.replace(/\/$/, "");
  const fetchImplementation = options.fetch ?? fetch;

  return async function provisionCommerceResources(
    input: CommerceProvisioningInput,
  ): Promise<CommerceProvisioningResult> {
    if (!options.internalApiToken) {
      return {
        ok: false,
        error: "commerce_backend_unavailable",
      };
    }

    try {
      const response = await fetchImplementation(
        `${medusaInternalUrl}/internal/platform/provision-tenant`,
        {
          method: "POST",
          body: JSON.stringify(input),
          headers: {
            "content-type": "application/json",
            "x-platform-internal-token": options.internalApiToken,
          },
        },
      );

      if (!response.ok) {
        return {
          ok: false,
          error: "commerce_backend_unavailable",
        };
      }

      const data = await response.json();
      const resources = data.resources;

      if (
        typeof resources !== "object" ||
        resources === null ||
        typeof resources.storeId !== "string" ||
        typeof resources.salesChannelId !== "string" ||
        typeof resources.stockLocationId !== "string" ||
        typeof resources.publishableKeyId !== "string" ||
        typeof resources.regionId !== "string" ||
        typeof resources.shippingProfileId !== "string" ||
        typeof resources.fulfillmentSetId !== "string" ||
        typeof resources.serviceZoneId !== "string" ||
        typeof resources.shippingOptionId !== "string"
      ) {
        return {
          ok: false,
          error: "commerce_backend_unavailable",
        };
      }

      // Store facade needs the publishable *token* (pk_…), never the api_key row id (apk_…).
      if (!isPublishableStoreToken(resources.publishableKeyId)) {
        return {
          ok: false,
          error: "commerce_backend_unavailable",
        };
      }

      return {
        ok: true,
        resources: {
          ...resources,
          publishableKeyId: resources.publishableKeyId.trim(),
        },
      };
    } catch {
      return {
        ok: false,
        error: "commerce_backend_unavailable",
      };
    }
  };
}
