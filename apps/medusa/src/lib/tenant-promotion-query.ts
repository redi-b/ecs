import { z } from "@medusajs/framework/zod";

export const tenantPromotionQuerySchema = z.object({
  tenant_id: z.string().trim().min(1).max(255),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  q: z.string().trim().max(200).optional(),
  status: z.enum(["active", "inactive", "draft"]).optional(),
  apply: z.enum(["code", "automatic"]).optional(),
  offer: z.enum(["order", "products", "free_shipping", "buyget", "percentage", "fixed"]).optional(),
  schedule: z.enum(["scheduled", "current", "expired", "unscheduled"]).optional(),
});

export type TenantPromotionQuery = z.infer<typeof tenantPromotionQuerySchema>;

/** Campaign, method and promotion belong to the same Medusa module. */
export function tenantPromotionFilters(input: TenantPromotionQuery, now = new Date()) {
  const prefix = `ecs_${input.tenant_id}_`.replace(/[\\%_]/g, "\\$&");
  const conditions: Record<string, unknown>[] = [
    {
      $or: [
        { metadata: { platform_tenant_id: input.tenant_id } },
        { campaign: { campaign_identifier: { $like: `${prefix}%` } } },
      ],
    },
  ];
  if (input.status) conditions.push({ status: input.status });
  if (input.apply) conditions.push({ is_automatic: input.apply === "automatic" });
  switch (input.offer) {
    case "buyget":
      conditions.push({ type: "buyget" });
      break;
    case "order":
    case "products":
      conditions.push({
        type: "standard",
        application_method: { target_type: input.offer === "order" ? "order" : "items" },
      });
      break;
    case "free_shipping":
      conditions.push({
        application_method: {
          target_type: "shipping_methods",
          type: "percentage",
          value: { $gte: 100 },
        },
      });
      break;
    case "percentage":
      conditions.push({
        application_method: {
          type: "percentage",
          $or: [{ target_type: { $ne: "shipping_methods" } }, { value: { $lt: 100 } }],
        },
      });
      break;
    case "fixed":
      conditions.push({ application_method: { type: "fixed" } });
      break;
  }
  if (input.schedule === "unscheduled") {
    conditions.push({
      $or: [{ campaign_id: null }, { campaign: { starts_at: null, ends_at: null } }],
    });
  } else if (input.schedule === "expired") {
    conditions.push({ campaign: { ends_at: { $lte: now } } });
  } else if (input.schedule === "scheduled") {
    conditions.push({
      campaign: { starts_at: { $gt: now }, $or: [{ ends_at: null }, { ends_at: { $gt: now } }] },
    });
  } else if (input.schedule === "current") {
    conditions.push({
      campaign: {
        $and: [
          { $or: [{ starts_at: { $ne: null } }, { ends_at: { $ne: null } }] },
          { $or: [{ starts_at: null }, { starts_at: { $lte: now } }] },
          { $or: [{ ends_at: null }, { ends_at: { $gt: now } }] },
        ],
      },
    });
  }
  return { ...(input.q ? { q: input.q } : {}), $and: conditions };
}
