import assert from "node:assert/strict";
import { test } from "node:test";
import { productMediaFilters, productMediaQuerySchema } from "./product-media-query";

test("media query preserves native Medusa filters and pagination", () => {
  const result = productMediaQuerySchema.parse({
    media: "without_media",
    sales_channel_id: ["sc_1"],
    status: ["draft"],
    category_id: ["cat_1"],
    offset: "20",
    limit: "10",
    fields: "id,title",
  });
  assert.equal(result.media, "without_media");
  assert.equal(result.offset, 20);
  assert.equal(result.limit, 10);
  assert.deepEqual(result.sales_channel_id, ["sc_1"]);
  assert.ok("status" in result);
  assert.deepEqual(result.status, ["draft"]);
  assert.equal(productMediaQuerySchema.safeParse({ media: "wrong" }).success, false);
  for (const extra of [
    { sales_channel_id: [] },
    { sales_channel_id: undefined },
    { sales_channel_id: ["sc_1", "sc_2"] },
    { limit: 101 },
    { offset: -1 },
  ]) {
    assert.equal(
      productMediaQuerySchema.safeParse({
        media: "with_media",
        sales_channel_id: ["sc_1"],
        ...extra,
      }).success,
      false,
    );
  }
});

test("media presence matches a thumbnail or a gallery image; absence requires neither", () => {
  assert.deepEqual(productMediaFilters("with_media"), {
    $or: [
      { $and: [{ thumbnail: { $ne: null } }, { thumbnail: { $ne: "" } }] },
      { images: { id: { $ne: null } } },
    ],
  });
  assert.deepEqual(productMediaFilters("without_media"), {
    $and: [{ $or: [{ thumbnail: null }, { thumbnail: "" }] }, { images: { id: null } }],
  });
});
