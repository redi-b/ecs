import type { Hono } from "hono";
import { z } from "zod";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

type Dependencies = Pick<
  PlatformAppOptions,
  "captureMerchantOrderCosts" | "internalApiToken" | "resolveTenantIdByMedusaSalesChannelId"
>;

const schema = z
  .object({
    medusaSalesChannelId: z.string().trim().min(1),
    orderId: z.string().trim().min(1),
    orderPlacedAt: z.string().datetime(),
    items: z
      .array(
        z
          .object({
            lineItemId: z.string().trim().min(1),
            quantity: z.number().int().positive(),
            unitCostAmount: z.number().int().nonnegative().nullable(),
            variantId: z.string().trim().min(1).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();

export function registerPlatformInternalOrderCostRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Dependencies,
) {
  app.post("/platform/internal/orders/cost-snapshots", async (context) => {
    const expected = options.internalApiToken?.trim();
    if (!expected || context.req.header("x-platform-internal-token") !== expected) {
      return context.json({ error: "internal_auth_required" }, 401);
    }
    if (!options.captureMerchantOrderCosts || !options.resolveTenantIdByMedusaSalesChannelId) {
      return context.json({ error: "order_cost_snapshot_unavailable" }, 503);
    }
    const parsed = schema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_order_cost_snapshot" }, 400);
    const tenantId = await options.resolveTenantIdByMedusaSalesChannelId(
      parsed.data.medusaSalesChannelId,
    );
    if (!tenantId) return context.json({ error: "tenant_not_found_for_sales_channel" }, 404);
    const result = await options.captureMerchantOrderCosts({
      tenantId,
      items: parsed.data.items.map((item) => ({
        ...item,
        currencyCode: "etb",
        orderId: parsed.data.orderId,
        orderPlacedAt: parsed.data.orderPlacedAt,
        tenantId,
      })),
    });
    return context.json(result, 201);
  });
}
