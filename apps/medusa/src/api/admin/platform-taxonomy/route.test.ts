import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "./route";

test("category list selects ownership metadata and labels before pagination", async () => {
  let body: any;
  const category = {
    id: "pcat_1",
    name: "Coffee",
    handle: "coffee",
    metadata: { platform_tenant_id: "tenant_1" },
  };
  const req = {
    validatedQuery: { tenant_id: "tenant_1", kind: "categories", limit: 10, offset: 20 },
    scope: {
      resolve: () => ({
        listAndCountProductCategories: async (filters: any, config: any) => {
          assert.deepEqual(filters, { metadata: { platform_tenant_id: "tenant_1" } });
          assert.equal(config.skip, 20);
          assert.equal(config.take, 10);
          for (const field of ["id", "name", "handle", "metadata", "parent_category_id", "rank"])
            assert.ok(config.select?.includes(field), `missing category field: ${field}`);
          return [[category], 21];
        },
      }),
    },
  };
  await GET(
    req as any,
    {
      json: (value: unknown) => {
        body = value;
      },
    } as any,
  );
  assert.deepEqual(body, { product_categories: [category], count: 21, limit: 10, offset: 20 });
});
