import {
  type AuthenticatedMedusaRequest,
  type MedusaResponse,
  refetchEntities,
} from "@medusajs/framework/http";
import {
  remapKeysForProduct,
  remapProductResponse,
} from "@medusajs/medusa/api/admin/products/helpers";
import { productMediaFilters } from "../../../lib/product-media-query";

/** Same query/payload path as Medusa's product list, with image presence predicates. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { media, category_missing, collection_missing, ...filters } = req.filterableFields;
  const { data, metadata } = await refetchEntities({
    entity: "product",
    idOrFilter: {
      ...filters,
      $and: [
        ...(Array.isArray(filters.$and) ? filters.$and : []),
        ...(media ? [productMediaFilters(media as "with_media" | "without_media")] : []),
        ...(category_missing === "true" ? [{ categories: { id: null } }] : []),
        ...(collection_missing === "true" ? [{ collection_id: null }] : []),
      ],
    },
    scope: req.scope,
    fields: remapKeysForProduct(req.queryConfig.fields ?? []),
    pagination: req.queryConfig.pagination,
  });
  return res.json({
    products: data.map(remapProductResponse),
    count: metadata.count,
    offset: metadata.skip,
    limit: metadata.take,
  });
}
