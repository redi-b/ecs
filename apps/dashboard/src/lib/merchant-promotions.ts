import { z } from "zod";
import { type PlatformRequestContext, platformFetch } from "@/lib/platform-api/client";

export const promotionSchema = z.object({
  applyToQuantity: z.number().nullable().optional().default(null),
  buyMinQuantity: z.number().nullable().optional().default(null),
  buyProductIds: z.array(z.string()).optional().default([]),
  campaignBudgetLimit: z.number().nullable().optional().default(null),
  campaignBudgetType: z.enum(["usage", "spend"]).nullable().optional().default(null),
  campaignName: z.string().nullable().optional().default(null),
  code: z.string(),
  createdAt: z.string(),
  currencyCode: z.string().nullable(),
  endsAt: z.string().nullable(),
  id: z.string(),
  isAutomatic: z.boolean().optional().default(false),
  isTaxInclusive: z.boolean().optional().default(false),
  maxQuantity: z.number().nullable().optional().default(null),
  method: z.enum(["percentage", "fixed"]),
  productIds: z.array(z.string()).optional().default([]),
  promotionType: z.enum(["standard", "buyget"]).optional().default("standard"),
  startsAt: z.string().nullable(),
  status: z.enum(["active", "inactive", "draft"]),
  targetType: z.enum(["order", "items", "shipping_methods"]).optional().default("order"),
  updatedAt: z.string(),
  usageCount: z.number(),
  usageLimit: z.number().nullable(),
  value: z.number(),
});
export type MerchantPromotion = z.infer<typeof promotionSchema>;

export async function getMerchantPromotions(
  context: PlatformRequestContext & { limit?: number; offset?: number; query?: string },
) {
  const search = new URLSearchParams({
    limit: String(context.limit ?? 100),
    offset: String(context.offset ?? 0),
  });
  if (context.query) search.set("q", context.query);
  const response = await platformFetch(`/platform/merchant/promotions?${search}`, context);
  const data = await response.json().catch(() => null);
  const parsed = z
    .object({ count: z.number(), promotions: z.array(promotionSchema) })
    .safeParse(data);
  return response.ok && parsed.success
    ? { ok: true as const, promotions: parsed.data }
    : {
        message:
          z.object({ error: z.string() }).safeParse(data).data?.error ?? "promotion_request_failed",
        ok: false as const,
        status: response.status,
      };
}
