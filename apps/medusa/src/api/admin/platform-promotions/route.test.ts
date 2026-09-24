import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "./route";

test("promotion query filters and counts before pagination with separate sort fields", async () => {
  let body: unknown;
  await GET(
    {
      validatedQuery: { tenant_id: "one", limit: 20, offset: 120, offer: "buyget" },
      scope: {
        resolve: () => ({
          listAndCountPromotions: async (filters: any, config: any) => {
            assert.equal(filters.$and[0].$or[0].metadata.platform_tenant_id, "one");
            assert.deepEqual(filters.$and[1], { type: "buyget" });
            assert.deepEqual(config.order, { created_at: "DESC", id: "ASC" });
            assert.equal(config.take, 20);
            assert.equal(config.skip, 120);
            return [[], 120];
          },
        }),
      },
    } as any,
    {
      json: (value: unknown) => {
        body = value;
      },
    } as any,
  );
  assert.deepEqual(body, { promotions: [], count: 120, limit: 20, offset: 120 });
});
