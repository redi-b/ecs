import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http";

import type { ProductSearchQueryInput } from "../../../lib/product-search-query";
import { MEILISEARCH_MODULE } from "../../../modules/meilisearch";
import type { ProductSearchProvider, ProductSearchQuery } from "../../../modules/meilisearch/types";

export async function GET(
  req: MedusaStoreRequest<ProductSearchQueryInput>,
  res: MedusaResponse,
) {
  const input = req.validatedQuery as ProductSearchQueryInput;
  const salesChannelIds = req.publishable_key_context.sales_channel_ids;
  if (!salesChannelIds.length) {
    return res.status(400).json({ message: "A sales channel is required for product search." });
  }

  const search = req.scope.resolve<ProductSearchProvider>(MEILISEARCH_MODULE);
  const sort =
    input.order === "created_at"
      ? ["created_at:desc"]
      : input.order === "title"
        ? ["title:asc"]
        : input.order === "-title"
          ? ["title:desc"]
          : input.order === "price"
            ? ["price_min_etb:asc"]
            : input.order === "-price"
              ? ["price_min_etb:desc"]
              : undefined;
  const baseQuery: ProductSearchQuery = {
    q: input.q,
    locale: req.locale ?? "en-ET",
    salesChannelIds,
  };
  const selected = {
    ...(input.category_id ? { categoryIds: [input.category_id] } : {}),
    ...(input.collection_id ? { collectionId: input.collection_id } : {}),
    ...(input.option?.length ? { optionPairs: input.option } : {}),
    ...(input.price_min !== undefined ? { priceMinEtb: input.price_min } : {}),
    ...(input.price_max !== undefined ? { priceMaxEtb: input.price_max } : {}),
  };
  const { categoryIds: _categoryIds, ...withoutCategory } = selected;
  const { collectionId: _collectionId, ...withoutCollection } = selected;
  const { optionPairs: _optionPairs, ...withoutOptions } = selected;
  const { priceMinEtb: _priceMinEtb, priceMaxEtb: _priceMaxEtb, ...withoutPrice } = selected;
  const [result, categoryFacets, collectionFacets, optionFacets, priceFacets] = await Promise.all([
    search.searchProducts({
      ...baseQuery, ...selected, limit: input.limit, offset: input.offset,
      facets: ["category_ids", "collection_id", "option_pairs", "price_min_etb"],
      ...(sort ? { sort } : {}),
    }),
    search.searchProducts({
      ...baseQuery, ...withoutCategory, limit: 0, facets: ["category_ids"],
    }),
    search.searchProducts({
      ...baseQuery, ...withoutCollection, limit: 0, facets: ["collection_id"],
    }),
    search.searchProducts({ ...baseQuery, ...withoutOptions, limit: 0, facets: ["option_pairs"] }),
    search.searchProducts({ ...baseQuery, ...withoutPrice, limit: 0, facets: ["price_min_etb"] }),
  ]);

  const facetDistribution = {
    ...(result.facetDistribution ?? {}),
    category_ids: categoryFacets.facetDistribution?.category_ids ?? {},
    collection_id: collectionFacets.facetDistribution?.collection_id ?? {},
    option_pairs: optionFacets.facetDistribution?.option_pairs ?? {},
  };

  return res.json({
    facet_distribution: facetDistribution,
    facet_stats: priceFacets.facetStats ?? {},
    product_ids: result.hits.map((hit) => hit.product_id),
    count: result.estimatedTotalHits,
    index_document_count: result.indexDocumentCount,
    limit: input.limit,
    offset: input.offset,
    processing_time_ms: Math.max(result.processingTimeMs, categoryFacets.processingTimeMs, collectionFacets.processingTimeMs, optionFacets.processingTimeMs, priceFacets.processingTimeMs),
    query: result.query,
  });
}
