import assert from "node:assert/strict";
import test from "node:test";

import { luviaV1EditorSchema } from "../templates/luvia/v1/editor";
import { luviaV1Defaults } from "../templates/luvia/v1/defaults";
import { luviaV1DataSchema } from "../templates/luvia/v1/schema";
import { storefrontEditorManifestSchema } from "./schema";

test("editor preview strategy is declared as a capability", () => {
  assert.equal(storefrontEditorManifestSchema.parse(luviaV1EditorSchema).previewMode, "iframe");
});

test("templates declare theme editing capabilities without renderer-specific branching", () => {
  const luvia = storefrontEditorManifestSchema.parse(luviaV1EditorSchema);
  assert.equal(luvia.theme?.allowSurfaceMode, false);
  assert.deepEqual(luvia.theme?.editableColors, ["primary", "foreground", "muted", "accent"]);
});

test("Luvia editor exposes reusable catalog and link-list fields", () => {
  const parsed = storefrontEditorManifestSchema.parse(luviaV1EditorSchema);
  const fields = parsed.sections.flatMap((section) => section.fields);

  assert.equal(fields.find((field) => field.path === "home.hero.featuredProductIds")?.kind, "products");
  assert.deepEqual(fields.find((field) => field.path === "home.hero.featuredProductIds")?.deprecatedPaths, ["home.hero.featuredProductId"]);
  assert.equal(fields.find((field) => field.path === "header.navigation")?.kind, "links");
  assert.equal(fields.find((field) => field.path === "footer.socialLinks")?.kind, "links");
  assert.equal(fields.find((field) => field.path === "home.categories.collectionIds")?.kind, "collections");
  assert.equal(fields.find((field) => field.path === "footer.quickLinks")?.kind, "links");
  assert.equal(fields.find((field) => field.path === "footer.inquiry.title")?.kind, "text");
  assert.equal(fields.find((field) => field.path === "home.brandStatement.imageAssetId")?.kind, "image");
  assert.equal(new Set(fields.map((field) => field.prop)).size, fields.length);
});

test("Luvia design credit is a platform-owned, toggle-only capability", () => {
  const manifest = storefrontEditorManifestSchema.parse(luviaV1EditorSchema);
  const creditSection = manifest.sections.find((section) => section.id === "footer-credit");
  const parsedDefaults = luviaV1DataSchema.parse(luviaV1Defaults);

  assert.deepEqual(creditSection?.fields.map((field) => field.path), ["footer.credit.enabled"]);
  assert.deepEqual(parsedDefaults.footer.credit, { enabled: true });
});
