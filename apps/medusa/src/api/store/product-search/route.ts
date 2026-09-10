import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http";

import type { ProductSearchQueryInput } from "../../../lib/product-search-query";
import { MEILISEARCH_MODULE } from "../../../modules/meilisearch";
import type { ProductSearchProvider } from "../../../modules/meilisearch/types";

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
  const result = await search.searchProducts({
    q: input.q,
    limit: input.limit,
    offset: input.offset,
    salesChannelIds,
  });

  return res.json({
    product_ids: result.hits.map((hit) => hit.id),
    count: result.estimatedTotalHits,
    index_document_count: result.indexDocumentCount,
    limit: input.limit,
    offset: input.offset,
    processing_time_ms: result.processingTimeMs,
    query: result.query,
  });
}
