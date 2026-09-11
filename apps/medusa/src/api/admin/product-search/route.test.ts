import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "./route";

test("admin product search includes drafts but remains sales-channel scoped", async () => {
  let query: unknown;
  let body: any;
  await GET(
    {
      validatedQuery: {
        q: "shirt",
        category_id: "pcat_1",
        collection_id: "pcol_1",
        limit: 6,
        offset: 0,
        sales_channel_id: "sc_merchant",
        status: "draft",
      },
      scope: {
        resolve: () => ({
          searchProducts: async (input: unknown) => {
            query = input;
            return {
              hits: [{ id: "p1", title: "Shirt", handle: "shirt", status: "draft" }],
              estimatedTotalHits: 1,
              processingTimeMs: 1,
              query: "shirt",
            };
          },
        }),
      },
    } as any,
    { json: (value: unknown) => (body = value) } as any,
  );

  assert.deepEqual(query, {
    q: "shirt",
    categoryIds: ["pcat_1"],
    collectionId: "pcol_1",
    limit: 6,
    offset: 0,
    salesChannelIds: ["sc_merchant"],
    includeDrafts: true,
    statuses: ["draft"],
  });
  assert.equal(body.hits[0].id, "p1");
});
