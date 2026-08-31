import assert from "node:assert/strict";
import test from "node:test";
import { luviaV1Defaults } from "../templates/luvia/v1/defaults";
import { luviaV1EditorSchema } from "../templates/luvia/v1/editor";
import { luviaV1DataSchema } from "../templates/luvia/v1/schema";
import { nexahubV1Defaults } from "../templates/nexahub/v1/defaults";
import { nexahubV1EditorSchema } from "../templates/nexahub/v1/editor";
import { nexahubV1DataSchema } from "../templates/nexahub/v1/schema";
import { storefrontEditorManifestSchema } from "./schema";

const syntheticEditorManifest = {
  ...luviaV1EditorSchema,
  templateKey: "test-template@1",
  sections: [
    {
      id: "test-content",
      label: "Test content",
      fields: [{ path: "home.title", prop: "homeTitle", label: "Title", kind: "text" }],
    },
  ],
};

test("editor preview strategy is declared as a capability", () => {
  assert.equal(storefrontEditorManifestSchema.parse(luviaV1EditorSchema).previewMode, "iframe");
});

test("synthetic manifests preserve template-agnostic editor validation", () => {
  const luvia = storefrontEditorManifestSchema.parse(luviaV1EditorSchema);
  assert.equal(luvia.theme?.allowSurfaceMode, false);
  assert.deepEqual(luvia.theme?.editableColors, ["primary", "foreground", "muted", "accent"]);
  const synthetic = storefrontEditorManifestSchema.parse(syntheticEditorManifest);
  assert.equal(synthetic.templateKey, "test-template@1");
  assert.deepEqual(synthetic.sections[0]?.fields.map((field) => field.path), ["home.title"]);
});

test("Luvia editor exposes reusable catalog and link-list fields", () => {
  const parsed = storefrontEditorManifestSchema.parse(luviaV1EditorSchema);
  const fields = parsed.sections.flatMap((section) => section.fields);

  assert.equal(
    fields.find((field) => field.path === "home.hero.featuredProductIds")?.kind,
    "products",
  );
  assert.deepEqual(
    fields.find((field) => field.path === "home.hero.featuredProductIds")?.deprecatedPaths,
    ["home.hero.featuredProductId"],
  );
  assert.equal(fields.find((field) => field.path === "header.navigation")?.kind, "links");
  assert.equal(fields.find((field) => field.path === "footer.socialLinks")?.kind, "links");
  assert.equal(
    fields.find((field) => field.path === "home.categories.collectionIds")?.kind,
    "collections",
  );
  assert.equal(fields.find((field) => field.path === "footer.quickLinks")?.kind, "links");
  assert.equal(fields.find((field) => field.path === "footer.inquiry.title")?.kind, "text");
  assert.equal(
    fields.find((field) => field.path === "home.brandStatement.imageAssetId")?.kind,
    "image",
  );
  assert.equal(new Set(fields.map((field) => field.prop)).size, fields.length);
});

test("variant preview contracts require an explicit variant order", () => {
  assert.throws(() => storefrontEditorManifestSchema.parse({
    ...syntheticEditorManifest,
    sections: [{ id: "collections", label: "Collections", fields: [{ path: "home.collections", prop: "collections", label: "Collections", kind: "collections", preview: { strategy: "variant-options" } }] }],
  }), /require variants/i);
});

test("Luvia design credit is a platform-owned, toggle-only capability", () => {
  const manifest = storefrontEditorManifestSchema.parse(luviaV1EditorSchema);
  const creditSection = manifest.sections.find((section) => section.id === "footer-credit");
  const parsedDefaults = luviaV1DataSchema.parse(luviaV1Defaults);

  assert.deepEqual(
    creditSection?.fields.map((field) => field.path),
    ["footer.credit.enabled"],
  );
  assert.deepEqual(parsedDefaults.footer.credit, { enabled: true });
});

test("NexaHub exposes a narrow theme and explicit catalog fallback", () => {
  const manifest = storefrontEditorManifestSchema.parse(nexahubV1EditorSchema);
  const fields = manifest.sections.flatMap((section) => section.fields);
  const defaults = nexahubV1DataSchema.parse(nexahubV1Defaults);

  assert.equal(manifest.theme?.allowSurfaceMode, false);
  assert.deepEqual(manifest.theme?.editableColors, ["primary"]);
  assert.deepEqual(defaults.home.bestSellers.productIds, []);
  assert.deepEqual(defaults.home.categories.collectionIds, []);
  assert.match(
    fields.find((field) => field.path === "home.bestSellers.productIds")?.helpText ?? "",
    /leave empty.*newest/i,
  );
  assert.deepEqual(defaults.home.featuredItem.productIds, []);
  assert.deepEqual(
    manifest.sections.find((section) => section.id === "footer-credit")?.fields.map((field) => field.path),
    ["footer.credit.enabled"],
  );
  assert.equal(new Set(fields.map((field) => field.prop)).size, fields.length);
  assert.equal(fields.find((field) => field.path === "header.navigation")?.preview?.strategy, "preserve-structure");
  assert.deepEqual(fields.find((field) => field.path === "home.categories.collectionIds")?.preview, {
    strategy: "variant-options",
    variants: ["featured", "standard"],
  });
  assert.equal(fields.find((field) => field.path === "footer.quickLinks")?.preview?.strategy, "list-items");
});

test("NexaHub declares listing preview through the generic page contract", () => {
  const manifest = storefrontEditorManifestSchema.parse(nexahubV1EditorSchema);
  assert.deepEqual(manifest.previewPages, [
    { id: "home", label: "Home" },
    { id: "products", label: "Products" },
  ]);
  assert.equal(manifest.sections.find((section) => section.id === "listing")?.previewPage, "products");
  const pageIds = new Set(manifest.previewPages.map((page) => page.id));
  for (const section of manifest.sections) {
    if (section.previewPage) assert.ok(pageIds.has(section.previewPage));
  }
});
