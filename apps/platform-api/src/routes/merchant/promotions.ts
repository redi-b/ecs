import { z } from "zod";
import type { PlatformAppOptions } from "../../app.js";
import { getPaginationValue } from "../shared.js";
import type { MerchantRouteApp, MerchantRouteHelpers } from "./context.js";

const promotionSchema = z.object({
  allocation: z.enum(["each", "across"]).nullish(),
  applyToQuantity: z.number().int().positive().nullish(),
  buyMinQuantity: z.number().int().positive().nullish(),
  buyProductIds: z.array(z.string().min(1)).optional(),
  campaignBudgetLimit: z.number().positive().nullish(),
  campaignBudgetType: z.enum(["usage", "spend"]).nullish(),
  campaignName: z.string().trim().max(120).nullish(),
  code: z.string().trim().min(2).max(64),
  currencyCode: z.string().trim().length(3).nullish(),
  endsAt: z.string().datetime().nullish(),
  isAutomatic: z.boolean().optional(),
  isTaxInclusive: z.boolean().optional(),
  maxQuantity: z.number().int().positive().nullish(),
  method: z.enum(["percentage", "fixed"]),
  productIds: z.array(z.string().min(1)).optional(),
  promotionType: z.enum(["standard", "buyget"]).optional(),
  startsAt: z.string().datetime().nullish(),
  status: z.enum(["active", "inactive", "draft"]),
  targetType: z.enum(["order", "items", "shipping_methods"]).optional(),
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
      ...toPromotionInput(parsed.data),
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
      ...toPromotionInput(parsed.data),
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

function toPromotionInput(data: z.infer<typeof promotionSchema>) {
  return {
    code: data.code,
    method: data.method,
    status: data.status,
    value: data.value,
    ...(data.allocation != null ? { allocation: data.allocation } : {}),
    ...(data.applyToQuantity !== undefined ? { applyToQuantity: data.applyToQuantity } : {}),
    ...(data.buyMinQuantity !== undefined ? { buyMinQuantity: data.buyMinQuantity } : {}),
    ...(data.buyProductIds !== undefined ? { buyProductIds: data.buyProductIds } : {}),
    ...(data.campaignBudgetLimit !== undefined
      ? { campaignBudgetLimit: data.campaignBudgetLimit }
      : {}),
    ...(data.campaignBudgetType !== undefined
      ? { campaignBudgetType: data.campaignBudgetType }
      : {}),
    ...(data.campaignName !== undefined ? { campaignName: data.campaignName } : {}),
    ...(data.currencyCode != null ? { currencyCode: data.currencyCode } : {}),
    ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
    ...(data.isAutomatic !== undefined ? { isAutomatic: data.isAutomatic } : {}),
    ...(data.isTaxInclusive !== undefined ? { isTaxInclusive: data.isTaxInclusive } : {}),
    ...(data.maxQuantity !== undefined ? { maxQuantity: data.maxQuantity } : {}),
    ...(data.productIds !== undefined ? { productIds: data.productIds } : {}),
    ...(data.promotionType !== undefined ? { promotionType: data.promotionType } : {}),
    ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
    ...(data.targetType !== undefined ? { targetType: data.targetType } : {}),
    ...(data.usageLimit !== undefined ? { usageLimit: data.usageLimit } : {}),
  };
}
