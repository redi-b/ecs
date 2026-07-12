import { z } from "zod";
import type { PlatformAppOptions } from "../../app.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteApp, MerchantRouteHelpers } from "./context.js";

const promotionSchema = z.object({
  code: z.string().trim().min(2).max(64),
  currencyCode: z.string().trim().length(3).nullish(),
  endsAt: z.string().datetime().nullish(),
  method: z.enum(["percentage", "fixed"]),
  startsAt: z.string().datetime().nullish(),
  status: z.enum(["active", "inactive", "draft"]),
  usageLimit: z.number().int().positive().nullish(),
  value: z.number().positive(),
});

export function registerMerchantPromotionRoutes(
  app: MerchantRouteApp,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/promotions", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantPromotions)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.listMerchantPromotions({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 100_000),
      ...(context.req.query("q")?.trim() ? { query: context.req.query("q")?.trim() } : {}),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, result.status as 401 | 503);
  });
  app.post("/platform/merchant/promotions", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const parsed = promotionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_promotion" }, 400);
    if (!options.createMerchantPromotion)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.createMerchantPromotion({
      ...parsed.data,
      ...(parsed.data.currencyCode === undefined ? {} : { currencyCode: parsed.data.currencyCode }),
      ...(parsed.data.endsAt === undefined ? {} : { endsAt: parsed.data.endsAt }),
      ...(parsed.data.startsAt === undefined ? {} : { startsAt: parsed.data.startsAt }),
      ...(parsed.data.usageLimit === undefined ? {} : { usageLimit: parsed.data.usageLimit }),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result, 201)
      : context.json({ error: result.error }, result.status as 401 | 503);
  });
  app.post("/platform/merchant/promotions/:promotionId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    const parsed = promotionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_promotion" }, 400);
    if (!options.updateMerchantPromotion)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.updateMerchantPromotion({
      ...parsed.data,
      ...(parsed.data.currencyCode === undefined ? {} : { currencyCode: parsed.data.currencyCode }),
      ...(parsed.data.endsAt === undefined ? {} : { endsAt: parsed.data.endsAt }),
      ...(parsed.data.startsAt === undefined ? {} : { startsAt: parsed.data.startsAt }),
      ...(parsed.data.usageLimit === undefined ? {} : { usageLimit: parsed.data.usageLimit }),
      promotionId: context.req.param("promotionId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, result.status as 401 | 404 | 503);
  });
  app.delete("/platform/merchant/promotions/:promotionId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.deleteMerchantPromotion)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const result = await options.deleteMerchantPromotion({
      promotionId: context.req.param("promotionId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, result.status as 401 | 404 | 503);
  });
}
