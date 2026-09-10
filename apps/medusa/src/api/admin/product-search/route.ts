import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import type { AdminProductSearchQueryInput } from "../../../lib/product-search-query";
import { MEILISEARCH_MODULE } from "../../../modules/meilisearch";
import type { ProductSearchProvider } from "../../../modules/meilisearch/types";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const input = req.validatedQuery as AdminProductSearchQueryInput;
  const search = req.scope.resolve<ProductSearchProvider>(MEILISEARCH_MODULE);
  const result = await search.searchProducts({
    q: input.q,
    limit: input.limit,
    offset: input.offset,
    salesChannelIds: [input.sales_channel_id],
    includeDrafts: true,
  });

  return res.json({
    hits: result.hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      handle: hit.handle,
      status: hit.status,
    })),
    count: result.estimatedTotalHits,
    limit: input.limit,
    offset: input.offset,
    processing_time_ms: result.processingTimeMs,
    query: result.query,
  });
}
