import { z } from "zod";
import { commerceErrorStatus } from "../../adapters/medusa/map-medusa-failure.js";
import type { PlatformAppOptions } from "../../app.js";

type MerchantPromotionRouteDependencies = Pick<
  PlatformAppOptions,
  | "createMerchantPromotion"
  | "createMerchantPromotionCodeBatch"
  | "deleteMerchantPromotion"
  | "executeMerchantMutation"
  | "listMerchantPromotions"
  | "updateMerchantPromotion"
>;

import { getPaginationValue } from "../shared.js";
import type { MerchantRouteApp, MerchantRouteHelpers } from "./context.js";

const promotionSchema = z
  .object({
    allocation: z.enum(["each", "across"]).nullish(),
    applyToQuantity: z.number().int().positive().nullish(),
    buyMinQuantity: z.number().int().positive().nullish(),
    buyProductIds: z.array(z.string().min(1)).max(100).optional(),
    campaignBudgetLimit: z.number().positive().nullish(),
    campaignBudgetType: z.enum(["usage", "spend"]).nullish(),
    campaignName: z.string().trim().max(120).nullish(),
    categoryIds: z.array(z.string().min(1)).max(100).optional(),
    code: z.string().trim().min(2).max(64),
    collectionIds: z.array(z.string().min(1)).max(100).optional(),
    currencyCode: z.string().trim().length(3).nullish(),
    endsAt: z.string().datetime().nullish(),
    isAutomatic: z.boolean().optional(),
    isTaxInclusive: z.boolean().optional(),
    maxQuantity: z.number().int().positive().nullish(),
    method: z.enum(["percentage", "fixed"]),
    productIds: z.array(z.string().min(1)).max(100).optional(),
    promotionType: z.enum(["standard", "buyget"]).optional(),
    registeredCustomersOnly: z.boolean().optional(),
    startsAt: z.string().datetime().nullish(),
    status: z.enum(["active", "inactive", "draft"]),
    targetType: z.enum(["order", "items", "shipping_methods"]).optional(),
    usageLimit: z.number().int().positive().nullish(),
    value: z.number().positive(),
  })
  .refine(
    (value) =>
      [value.productIds, value.categoryIds, value.collectionIds].filter(
        (ids) => ids && ids.length > 0,
      ).length <= 1,
  );

const promotionBatchSchema = z.object({
  count: z.number().int().min(2).max(50),
  prefix: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Za-z0-9]+$/),
  promotionId: z.string().trim().min(1),
  suffixLength: z.number().int().min(6).max(12),
  usageLimit: z.number().int().positive().nullish(),
});

export function registerMerchantPromotionRoutes(
  app: MerchantRouteApp,
  options: MerchantPromotionRouteDependencies,
  helpers: MerchantRouteHelpers,
) {
  app.get("/platform/merchant/promotions", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, { promotions: ["read"] });
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantPromotions)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const statusParam = context.req.query("status")?.trim().toLowerCase();
    const status =
      statusParam === "active" || statusParam === "inactive" || statusParam === "draft"
        ? statusParam
        : undefined;
    const apply = parsePromotionFilter(context.req.query("apply"), ["code", "automatic"] as const);
    const schedule = parsePromotionFilter(context.req.query("schedule"), [
      "scheduled",
      "current",
      "expired",
      "unscheduled",
    ] as const);
    if (!schedule.ok) return context.json({ error: "invalid_promotion_filter" }, 400);
    const offer = parsePromotionFilter(context.req.query("offer"), [
      "order",
      "products",
      "free_shipping",
      "buyget",
      "percentage",
      "fixed",
    ] as const);
    if (!apply.ok || !offer.ok) return context.json({ error: "invalid_promotion_filter" }, 400);
    const result = await options.listMerchantPromotions({
      ...(schedule.value ? { schedule: schedule.value } : {}),
      ...(apply.value ? { apply: apply.value } : {}),
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 100_000),
      ...(offer.value ? { offer: offer.value } : {}),
      ...(context.req.query("q")?.trim() ? { query: context.req.query("q")?.trim() } : {}),
      ...(status ? { status } : {}),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, commerceErrorStatus(result.status));
  });
  app.post("/platform/merchant/promotions", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, {
      promotions: ["manage"],
    });
    if (!merchant.ok) return merchant.response;
    const parsed = promotionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_promotion" }, 400);
    if (!options.createMerchantPromotion || !options.executeMerchantMutation)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const createMerchantPromotion = options.createMerchantPromotion;
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const input = {
      ...toPromotionInput(parsed.data),
      salesChannelId: merchant.result.context.medusaSalesChannelId ?? undefined,
      tenantId: merchant.result.context.tenantId,
    };
    const execution = await options.executeMerchantMutation(
      {
        actorUserId: merchant.session.user.id,
        idempotencyKey,
        operation: "promotion.create",
        payload: input,
        requestId: context.get("requestId"),
        resourceKeys: [`promotion-code:${parsed.data.code.trim().toUpperCase()}`],
        source: "assisted_sale",
        tenantId: merchant.result.context.tenantId,
      },
      () => createMerchantPromotion(input),
    );
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    context.header("x-idempotent-replay", String(execution.replayed));
    const result = execution.value;
    return result.ok
      ? context.json(result, 201)
      : context.json({ error: result.error }, commerceErrorStatus(result.status));
  });
  app.post("/platform/merchant/promotions/batches", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, {
      promotions: ["manage"],
    });
    if (!merchant.ok) return merchant.response;
    const parsed = promotionBatchSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_promotion_batch" }, 400);
    if (!options.createMerchantPromotionCodeBatch || !options.executeMerchantMutation) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
    const createMerchantPromotionCodeBatch = options.createMerchantPromotionCodeBatch;
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const input = { ...parsed.data, tenantId: merchant.result.context.tenantId };
    const execution = await options.executeMerchantMutation(
      {
        actorUserId: merchant.session.user.id,
        idempotencyKey,
        operation: "promotion.batch.create",
        payload: input,
        requestId: context.get("requestId"),
        resourceKeys: [`promotion:${parsed.data.promotionId}`],
        source: "assisted_sale",
        tenantId: merchant.result.context.tenantId,
      },
      () => createMerchantPromotionCodeBatch(input),
    );
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    context.header("x-idempotent-replay", String(execution.replayed));
    return execution.value.ok
      ? context.json(execution.value, 201)
      : context.json({ error: execution.value.error }, commerceErrorStatus(execution.value.status));
  });
  app.post("/platform/merchant/promotions/:promotionId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, {
      promotions: ["manage"],
    });
    if (!merchant.ok) return merchant.response;
    const parsed = promotionSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_promotion" }, 400);
    if (!options.updateMerchantPromotion || !options.executeMerchantMutation)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const updateMerchantPromotion = options.updateMerchantPromotion;
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const input = {
      ...toPromotionInput(parsed.data),
      promotionId: context.req.param("promotionId"),
      salesChannelId: merchant.result.context.medusaSalesChannelId ?? undefined,
      tenantId: merchant.result.context.tenantId,
    };
    const execution = await options.executeMerchantMutation(
      {
        actorUserId: merchant.session.user.id,
        idempotencyKey,
        operation: "promotion.update",
        payload: input,
        requestId: context.get("requestId"),
        resourceKeys: [`promotion:${input.promotionId}`],
        source: "assisted_sale",
        tenantId: merchant.result.context.tenantId,
      },
      () => updateMerchantPromotion(input),
    );
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    context.header("x-idempotent-replay", String(execution.replayed));
    const result = execution.value;
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, commerceErrorStatus(result.status));
  });
  app.delete("/platform/merchant/promotions/:promotionId", async (context) => {
    const merchant = await helpers.getAuthorizedMerchantContext(context, {
      promotions: ["manage"],
    });
    if (!merchant.ok) return merchant.response;
    if (!options.deleteMerchantPromotion || !options.executeMerchantMutation)
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    const deleteMerchantPromotion = options.deleteMerchantPromotion;
    const idempotencyKey = context.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) return context.json({ error: "idempotency_key_required" }, 400);
    const input = {
      promotionId: context.req.param("promotionId"),
      tenantId: merchant.result.context.tenantId,
    };
    const execution = await options.executeMerchantMutation(
      {
        actorUserId: merchant.session.user.id,
        idempotencyKey,
        operation: "promotion.delete",
        payload: input,
        requestId: context.get("requestId"),
        resourceKeys: [`promotion:${input.promotionId}`],
        source: "assisted_sale",
        tenantId: merchant.result.context.tenantId,
      },
      () => deleteMerchantPromotion(input),
    );
    if (!execution.ok) return context.json({ error: execution.error }, execution.status);
    context.header("x-idempotent-replay", String(execution.replayed));
    const result = execution.value;
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, commerceErrorStatus(result.status));
  });
}

function parsePromotionFilter<const T extends readonly string[]>(
  value: string | undefined,
  values: T,
) {
  if (!value?.trim() || value === "all") return { ok: true as const, value: undefined };
  return values.includes(value as T[number])
    ? { ok: true as const, value: value as T[number] }
    : { ok: false as const, value: undefined };
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
    ...(data.categoryIds !== undefined ? { categoryIds: data.categoryIds } : {}),
    ...(data.collectionIds !== undefined ? { collectionIds: data.collectionIds } : {}),
    ...(data.currencyCode != null ? { currencyCode: data.currencyCode } : {}),
    ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
    ...(data.isAutomatic !== undefined ? { isAutomatic: data.isAutomatic } : {}),
    ...(data.isTaxInclusive !== undefined ? { isTaxInclusive: data.isTaxInclusive } : {}),
    ...(data.maxQuantity !== undefined ? { maxQuantity: data.maxQuantity } : {}),
    ...(data.productIds !== undefined ? { productIds: data.productIds } : {}),
    ...(data.promotionType !== undefined ? { promotionType: data.promotionType } : {}),
    ...(data.registeredCustomersOnly !== undefined
      ? { registeredCustomersOnly: data.registeredCustomersOnly }
      : {}),
    ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
    ...(data.targetType !== undefined ? { targetType: data.targetType } : {}),
    ...(data.usageLimit !== undefined ? { usageLimit: data.usageLimit } : {}),
  };
}
