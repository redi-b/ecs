import assert from "node:assert/strict";
import test from "node:test";

import { classicV1EditorSchema } from "../templates/classic/v1/editor";
import { classicV1DataSchema } from "../templates/classic/v1/schema";
import { classicV1Defaults } from "../templates/classic/v1/defaults";
import { storefrontEditorManifestSchema } from "./schema";

test("classic v1 editor manifest exposes CMS and merchandising field kinds", () => {
  const parsed = storefrontEditorManifestSchema.parse(classicV1EditorSchema);

  const fieldKinds = parsed.sections.flatMap((section) =>
    section.fields.map((field) => field.kind),
  );

  assert.deepEqual(
    [...new Set(fieldKinds)].sort(),
    ["boolean", "collection", "color", "image", "link", "products", "text", "textarea"].sort(),
  );
});

test("classic v1 editor manifest has no dynamic commerce pricing fields", () => {
  const parsed = storefrontEditorManifestSchema.parse(classicV1EditorSchema);
  const serialized = JSON.stringify(parsed).toLowerCase();

  assert.equal(serialized.includes("product.price"), false);
  assert.equal(serialized.includes("inventory"), false);
  assert.equal(serialized.includes("checkout"), false);
});

test("classic v1 editor manifest maps every field to a unique preview prop", () => {
  const parsed = storefrontEditorManifestSchema.parse(classicV1EditorSchema);
  const props = parsed.sections.flatMap((section) => section.fields.map((field) => field.prop));

  assert.equal(new Set(props).size, props.length);
  assert.ok(props.includes("heroTitle"));
  assert.ok(props.includes("primaryColor"));
  assert.ok(props.includes("productSectionTitle"));
  assert.ok(props.includes("featuredCollectionId"));
  assert.ok(props.includes("featuredProductIds"));
  assert.ok(props.includes("testimonialsEnabled"));
  assert.equal(parsed.templateKey, "classic@1");
});

test("classic v1 defaults satisfy schema including section toggles", () => {
  const parsed = classicV1DataSchema.parse(classicV1Defaults);
  assert.equal(parsed.home.featuredProducts.enabled, true);
  assert.equal(parsed.home.featuredCollection?.enabled, false);
  assert.equal(parsed.home.testimonials?.enabled, false);
  assert.equal(parsed.home.trust?.enabled, true);
});
