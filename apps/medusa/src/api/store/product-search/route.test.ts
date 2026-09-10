import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "./route";

test("store product search is scoped to publishable-key sales channels", async () => {
  let query: unknown;
  let body: unknown;
  await GET(
    {
      validatedQuery: { q: "cofee", limit: 12, offset: 4 },
      publishable_key_context: { sales_channel_ids: ["sc_1", "sc_2"] },
      scope: {
        resolve: () => ({
          searchProducts: async (input: unknown) => {
            query = input;
            return {
              hits: [{ id: "prod_1" }],
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

  assert.deepEqual(query, {
    q: "cofee",
    limit: 12,
    offset: 4,
    salesChannelIds: ["sc_1", "sc_2"],
  });
  assert.deepEqual(body, {
    product_ids: ["prod_1"],
    count: 1,
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
