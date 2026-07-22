import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows";

function getInternalToken(request: MedusaRequest) {
  return request.headers["x-platform-internal-token"];
}

function getExpectedInternalToken() {
  return (
    process.env.PLATFORM_INTERNAL_API_TOKEN ??
    (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token")
  );
}

type EnsureBody = {
  currencyCode?: unknown;
  deliveryShippingOptionId?: unknown;
};

/**
 * Ensures a free "Store Pickup" flat option exists in the same service zone as the
 * tenant delivery option. Idempotent for shops provisioned before free pickup existed.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const expectedToken = getExpectedInternalToken();

  if (!expectedToken || getInternalToken(req) !== expectedToken) {
    return res.status(401).json({ error: "internal_auth_required" });
  }

  const body = (req.body ?? {}) as EnsureBody;
  const deliveryShippingOptionId =
    typeof body.deliveryShippingOptionId === "string"
      ? body.deliveryShippingOptionId.trim()
      : "";
  const currencyCode =
    typeof body.currencyCode === "string" && body.currencyCode.trim()
      ? body.currencyCode.trim().toLowerCase()
      : "etb";

  if (!deliveryShippingOptionId) {
    return res.status(400).json({ error: "invalid_ensure_pickup_input" });
  }

  try {
    const query = req.scope.resolve("query") as {
      graph: (input: {
        entity: string;
        fields: string[];
        filters?: Record<string, unknown>;
      }) => Promise<{ data: unknown[] }>;
    };

    const { data: deliveryOptions } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "name", "service_zone_id", "shipping_profile_id", "provider_id"],
      filters: { id: deliveryShippingOptionId },
    });

    const delivery = deliveryOptions[0] as
      | {
          id?: string;
          service_zone_id?: string;
          shipping_profile_id?: string;
          provider_id?: string;
        }
      | undefined;

    if (!delivery?.service_zone_id || !delivery.shipping_profile_id) {
      return res.status(404).json({ error: "delivery_shipping_option_not_found" });
    }

    const { data: zoneOptions } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "name", "prices.amount", "prices.currency_code"],
      filters: {
        service_zone_id: delivery.service_zone_id,
        provider_id: delivery.provider_id ?? "manual_manual",
      },
    });

    const existingPickup = (zoneOptions as Array<{ id?: string; name?: string }>).find((option) => {
      const name = option.name ?? "";
      return /pickup/i.test(name) || /collect/i.test(name);
    });

    if (existingPickup?.id) {
      return res.status(200).json({
        ok: true,
        created: false,
        pickupOptionId: existingPickup.id,
      });
    }

    const workflow = createShippingOptionsWorkflow(req.scope);
    const { result } = await workflow.run({
      input: [
        {
          name: "Store Pickup",
          service_zone_id: delivery.service_zone_id,
          shipping_profile_id: delivery.shipping_profile_id,
          provider_id: delivery.provider_id ?? "manual_manual",
          type: {
            label: "Store Pickup",
            description: "Customer collects the order",
            code: "store_pickup",
          },
          price_type: "flat" as const,
          prices: [
            {
              amount: 0,
              currency_code: currencyCode,
            },
          ],
        },
      ],
    });

    const created = Array.isArray(result) ? result[0] : result;
    const pickupOptionId =
      created && typeof created === "object" && "id" in created
        ? String((created as { id: string }).id)
        : null;

    if (!pickupOptionId) {
      return res.status(502).json({ error: "pickup_option_create_failed" });
    }

    return res.status(201).json({
      ok: true,
      created: true,
      pickupOptionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ensure_pickup_failed";
    return res.status(502).json({ error: "ensure_pickup_failed", message });
  }
}
