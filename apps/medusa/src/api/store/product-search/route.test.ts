import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "./route";

test("store product search is scoped to publishable-key sales channels", async () => {
  const queries: unknown[] = [];
  let body: unknown;
  await GET(
    {
      validatedQuery: {
        q: "cofee",
        category_id: "pcat_1",
        collection_id: "pcol_1",
        limit: 12,
        offset: 4,
        order: "created_at",
      },
      publishable_key_context: { sales_channel_ids: ["sc_1", "sc_2"] },
      locale: "am-ET",
      scope: {
        resolve: () => ({
          searchProducts: async (input: unknown) => {
            queries.push(input);
            return {
              facetDistribution: { category_ids: { pcat_1: 1 }, collection_id: { pcol_1: 1 } },
              hits: [{ id: "am-ET:prod_1", product_id: "prod_1" }],
              indexDocumentCount: 24,
              estimatedTotalHits: 1,
              processingTimeMs: 2,
              query: "cofee",
            };
          },
        }),
      },
    } as any,
    { json: (value: unknown) => (body = value) } as any,
  );

  assert.deepEqual(queries[0], {
    q: "cofee",
    locale: "am-ET",
    categoryIds: ["pcat_1"],
    collectionId: "pcol_1",
    limit: 12,
    offset: 4,
    salesChannelIds: ["sc_1", "sc_2"],
    facets: ["category_ids", "collection_id", "option_pairs", "price_min_etb"],
    sort: ["created_at:desc"],
  });
  assert.deepEqual(body, {
    facet_distribution: { category_ids: { pcat_1: 1 }, collection_id: { pcol_1: 1 }, option_pairs: {} },
    facet_stats: {},
    product_ids: ["prod_1"],
    count: 1,
    index_document_count: 24,
    limit: 12,
    offset: 4,
    processing_time_ms: 2,
    query: "cofee",
  });
});

test("store product search rejects requests without a sales channel", async () => {
  let status: number | undefined;
  let body: unknown;
  await GET(
    {
      validatedQuery: { q: "coffee", limit: 24, offset: 0 },
      publishable_key_context: { sales_channel_ids: [] },
    } as any,
    {
      status: (value: number) => {
        status = value;
        return { json: (result: unknown) => (body = result) };
      },
    } as any,
  );
  assert.equal(status, 400);
  assert.deepEqual(body, { message: "A sales channel is required for product search." });
});
