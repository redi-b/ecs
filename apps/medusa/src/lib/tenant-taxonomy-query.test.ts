import assert from "node:assert/strict";
import { test } from "node:test";
import { tenantTaxonomyFilters, tenantTaxonomyQuerySchema } from "./tenant-taxonomy-query";

test("taxonomy filters include tenant ownership before pagination", () => {
  const input = tenantTaxonomyQuerySchema.parse({
    tenant_id: " tenant_1 ",
    kind: "categories",
    offset: "100",
    q: " coffee ",
  });
  assert.equal(input.limit, 100);
  assert.equal(input.offset, 100);
  assert.deepEqual(tenantTaxonomyFilters(input), {
    metadata: { platform_tenant_id: "tenant_1" },
    q: "coffee",
  });
});

test("taxonomy query rejects missing ownership and invalid pagination", () => {
  for (const extra of [
    { tenant_id: "" },
    { tenant_id: undefined },
    { limit: "101" },
    { offset: "-1" },
    { offset: "0.5" },
    { kind: "products" },
  ]) {
    assert.equal(
      tenantTaxonomyQuerySchema.safeParse({ tenant_id: "tenant_1", kind: "collections", ...extra })
        .success,
      false,
    );
  }
});

test("visibility keeps tenant ownership outside the public alternatives and scopes direct children", () => {
  const filters = tenantTaxonomyFilters(
    tenantTaxonomyQuerySchema.parse({
      tenant_id: "tenant_1",
      kind: "categories",
      visibility: "public",
      parent_id: "root",
    }),
  );
  assert.deepEqual(filters.metadata, { platform_tenant_id: "tenant_1" });
  assert.equal(filters.parent_category_id, null);
  assert.deepEqual(filters.$or, [
    { metadata: { visibility: null } },
    { metadata: { visibility: { $ne: "hidden" } } },
  ]);
});
