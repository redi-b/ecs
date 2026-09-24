import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { IProductModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  type TenantTaxonomyQuery,
  tenantTaxonomyFilters,
} from "../../../lib/tenant-taxonomy-query";

/** Platform credentials only: tenant is resolved by the platform API, never by the merchant. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const input = req.validatedQuery as TenantTaxonomyQuery;
  const products = req.scope.resolve<IProductModuleService>(Modules.PRODUCT);
  // Metadata filtering is supported by module services, not query.graph.
  // Apply tenant scope before both counting and pagination.
  const filters = tenantTaxonomyFilters(input);
  if (input.kind === "categories") {
    // Module services support JSON metadata predicates; published filter DTOs
    // omit metadata from nested boolean expressions.
    const [categories, count] = await products.listAndCountProductCategories(
      filters as Parameters<IProductModuleService["listAndCountProductCategories"]>[0],
      {
        // The category tree repository initializes an empty field selection when
        // omitted. Request the payload explicitly, including tenant ownership.
        select: [
          "id",
          "name",
          "handle",
          "is_active",
          "is_internal",
          "parent_category_id",
          "rank",
          "metadata",
          "created_at",
          "updated_at",
        ],
        take: input.limit,
        skip: input.offset,
        order: { rank: "ASC", id: "ASC" },
      },
    );
    return res.json({
      product_categories: categories,
      count,
      limit: input.limit,
      offset: input.offset,
    });
  }
  const [collections, count] = await products.listAndCountProductCollections(
    filters as Parameters<IProductModuleService["listAndCountProductCollections"]>[0],
    {
      select: ["id", "title", "handle", "metadata", "created_at", "updated_at"],
      take: input.limit,
      skip: input.offset,
      order: { created_at: "DESC", id: "ASC" },
    },
  );
  return res.json({ collections, count, limit: input.limit, offset: input.offset });
}
