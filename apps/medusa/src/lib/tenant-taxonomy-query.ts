import { z } from "@medusajs/framework/zod";

export const tenantTaxonomyQuerySchema = z.object({
  tenant_id: z.string().trim().min(1).max(255),
  kind: z.enum(["categories", "collections"]),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  q: z.string().trim().max(200).optional(),
  visibility: z.enum(["public", "hidden"]).optional(),
  parent_id: z.string().trim().min(1).max(255).optional(),
});

export type TenantTaxonomyQuery = z.infer<typeof tenantTaxonomyQuerySchema>;

export function tenantTaxonomyFilters(input: TenantTaxonomyQuery) {
  return {
    metadata: {
      platform_tenant_id: input.tenant_id,
      ...(input.visibility === "hidden" ? { visibility: "hidden" } : {}),
    },
    ...(input.q ? { q: input.q } : {}),
    ...(input.kind === "categories" && input.parent_id
      ? { parent_category_id: input.parent_id === "root" ? null : input.parent_id }
      : {}),
    ...(input.visibility === "public"
      ? {
          $or: [
            { metadata: { visibility: null } },
            { metadata: { visibility: { $ne: "hidden" } } },
          ],
        }
      : {}),
  };
}
