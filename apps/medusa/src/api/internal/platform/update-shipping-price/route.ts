import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows";

function getInternalToken(request: MedusaRequest) {
  return request.headers["x-platform-internal-token"];
}

function getExpectedInternalToken() {
  return (
    process.env.PLATFORM_INTERNAL_API_TOKEN ??
    (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token")
  );
}

type UpdateShippingPriceBody = {
  amount?: unknown;
  currencyCode?: unknown;
  shippingOptionId?: unknown;
};

function parseBody(body: unknown): {
  amount: number;
  currencyCode: string;
  shippingOptionId: string;
} | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const input = body as UpdateShippingPriceBody;
  const shippingOptionId =
    typeof input.shippingOptionId === "string" ? input.shippingOptionId.trim() : "";
  const currencyCode =
    typeof input.currencyCode === "string" ? input.currencyCode.trim().toLowerCase() : "";

  let amount: number | null = null;
  if (typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount >= 0) {
    amount = input.amount;
  } else if (typeof input.amount === "string" && input.amount.trim()) {
    const parsed = Number.parseFloat(input.amount.trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      amount = parsed;
    }
  }

  if (!shippingOptionId || !currencyCode || amount == null) {
    return null;
  }

  return { amount, currencyCode, shippingOptionId };
}

/**
 * Syncs merchant default delivery fee onto the tenant flat-rate shipping option.
 * Auth: x-platform-internal-token (same boundary as provision-tenant).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const expectedToken = getExpectedInternalToken();

  if (!expectedToken || getInternalToken(req) !== expectedToken) {
    return res.status(401).json({
      error: "internal_auth_required",
    });
  }

  const parsed = parseBody(req.body);
  if (!parsed) {
    return res.status(400).json({
      error: "invalid_update_shipping_price_input",
    });
  }

  try {
    const workflow = updateShippingOptionsWorkflow(req.scope);
    await workflow.run({
      input: [
        {
          id: parsed.shippingOptionId,
          prices: [
            {
              currency_code: parsed.currencyCode,
              amount: parsed.amount,
            },
          ],
        },
      ],
    });

    const query = req.scope.resolve("query") as {
      graph: (input: {
        entity: string;
        fields: string[];
        filters?: Record<string, unknown>;
      }) => Promise<{ data: unknown[] }>;
    };
    const { data } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "prices.amount", "prices.currency_code"],
      filters: { id: parsed.shippingOptionId },
    });
    const option = data[0] as
      | { prices?: Array<{ amount?: unknown; currency_code?: unknown }> }
      | undefined;
    const verified = (option?.prices ?? []).some((price) => {
      const amount =
        typeof price.amount === "number"
          ? price.amount
          : typeof price.amount === "string"
            ? Number.parseFloat(price.amount)
            : Number.NaN;
      const currencyCode =
        typeof price.currency_code === "string" ? price.currency_code.toLowerCase() : "";
      return (
        currencyCode === parsed.currencyCode &&
        Number.isFinite(amount) &&
        Math.abs(amount - parsed.amount) < 0.005
      );
    });

    if (!verified) {
      return res.status(502).json({
        error: "shipping_price_verification_failed",
        shippingOptionId: parsed.shippingOptionId,
        amount: parsed.amount,
        currencyCode: parsed.currencyCode,
      });
    }

    return res.status(200).json({
      ok: true,
      shippingOptionId: parsed.shippingOptionId,
      amount: parsed.amount,
      currencyCode: parsed.currencyCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "update_shipping_price_failed";
    return res.status(502).json({
      error: "update_shipping_price_failed",
      message,
    });
  }
}
