import assert from "node:assert/strict";
import test from "node:test";

import { classicV1EditorSchema } from "../templates/classic/v1/editor";
import { classicV1DataSchema } from "../templates/classic/v1/schema";
import { classicV1Defaults } from "../templates/classic/v1/defaults";
import { luviaV1EditorSchema } from "../templates/luvia/v1/editor";
import { luviaV1Defaults } from "../templates/luvia/v1/defaults";
import { luviaV1DataSchema } from "../templates/luvia/v1/schema";
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

test("editor preview strategy is declared as a capability", () => {
  assert.equal(storefrontEditorManifestSchema.parse(luviaV1EditorSchema).previewMode, "iframe");
  assert.equal(storefrontEditorManifestSchema.parse(classicV1EditorSchema).previewMode, "iframe");
});

test("templates declare theme editing capabilities without renderer-specific branching", () => {
  const luvia = storefrontEditorManifestSchema.parse(luviaV1EditorSchema);
  const classic = storefrontEditorManifestSchema.parse(classicV1EditorSchema);

  assert.equal(luvia.theme?.allowSurfaceMode, false);
  assert.deepEqual(luvia.theme?.editableColors, ["primary", "foreground", "muted", "accent"]);
  assert.equal(classic.theme, undefined);
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
  assert.equal(parsed.home.featuredCollection?.title, "");
  assert.equal(parsed.home.testimonials?.enabled, false);
  assert.equal(parsed.home.trust?.enabled, true);
});
