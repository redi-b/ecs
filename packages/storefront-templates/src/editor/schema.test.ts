import assert from "node:assert/strict";
import test from "node:test";

import { classicV1EditorSchema } from "../templates/classic/v1/editor";
import { storefrontEditorManifestSchema } from "./schema";

test("classic v1 editor manifest exposes only CMS-safe field kinds", () => {
  const parsed = storefrontEditorManifestSchema.parse(classicV1EditorSchema);

  const fieldKinds = parsed.sections.flatMap((section) =>
    section.fields.map((field) => field.kind),
  );

  assert.deepEqual(
    [...new Set(fieldKinds)].sort(),
    ["color", "image", "link", "text", "textarea"].sort(),
  );
});

test("classic v1 editor manifest has no dynamic commerce fields", () => {
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
});
