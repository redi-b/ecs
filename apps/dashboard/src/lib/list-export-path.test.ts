import assert from "node:assert/strict";
import { test } from "node:test";
import { listExportPath } from "./list-export-path";

test("export carries normalized filters, preserves tenant context and excludes pagination", () => {
  const path = listExportPath("/dashboard/products/actions/export?tenantId=one", {
    q: "coffee & tea",
    status: "draft",
    categoryId: "none",
    media: "without_media",
    collectionId: "all",
    page: "3",
    pageSize: "20",
  });
  const url = new URL(path, "https://shop.example");
  assert.equal(url.searchParams.get("tenantId"), "one");
  assert.equal(url.searchParams.get("q"), "coffee & tea");
  assert.equal(url.searchParams.get("categoryId"), "none");
  assert.equal(url.searchParams.get("media"), "without_media");
  for (const key of ["page", "pageSize", "collectionId"])
    assert.equal(url.searchParams.has(key), false);
});
