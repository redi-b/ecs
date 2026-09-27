import assert from "node:assert/strict";
import test from "node:test";
import { afroV1Defaults } from "../templates/afro/v1/defaults";
import { afroV1EditorSchema } from "../templates/afro/v1/editor";
import { afroV1DataSchema } from "../templates/afro/v1/schema";
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
  assert.deepEqual(luvia.theme?.editableColors, ["primary"]);
  const synthetic = storefrontEditorManifestSchema.parse(syntheticEditorManifest);
  assert.equal(synthetic.templateKey, "test-template@1");
  assert.deepEqual(
    synthetic.sections[0]?.fields.map((field) => field.path),
    ["home.title"],
  );
});

test("Luvia editor exposes a focused home-page surface", () => {
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
  assert.equal(
    fields.some((field) => field.path === "header.navigation"),
    false,
  );
  assert.equal(fields.find((field) => field.path === "footer.socialLinks")?.kind, "links");
  assert.equal(
    fields.find((field) => field.path === "home.categories.categoryIds")?.kind,
    "categories",
  );
  assert.equal(
    fields.some((field) => field.path === "footer.quickLinks"),
    false,
  );
  assert.equal(fields.find((field) => field.path === "footer.inquiry.title")?.kind, "text");
  assert.equal(
    fields.some((field) => field.path.endsWith("Href")),
    false,
  );
  assert.equal(
    fields.find((field) => field.path === "home.categories.imageAssetId")?.kind,
    "image",
  );
  assert.equal(new Set(fields.map((field) => field.prop)).size, fields.length);
});

test("variant preview contracts require an explicit variant order", () => {
  assert.throws(
    () =>
      storefrontEditorManifestSchema.parse({
        ...syntheticEditorManifest,
        sections: [
          {
            id: "collections",
            label: "Collections",
            fields: [
              {
                path: "home.collections",
                prop: "collections",
                label: "Collections",
                kind: "collections",
                preview: { strategy: "variant-options" },
              },
            ],
          },
        ],
      }),
    /require variants/i,
  );
});

test("Luvia design credit remains platform-owned and is not merchant-editable", () => {
  const manifest = storefrontEditorManifestSchema.parse(luviaV1EditorSchema);
  const fields = manifest.sections.flatMap((section) => section.fields);
  const parsedDefaults = luviaV1DataSchema.parse(luviaV1Defaults);

  assert.equal(
    fields.some((field) => field.path.startsWith("footer.credit")),
    false,
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
  assert.deepEqual(defaults.home.categories.categoryIds, []);
  assert.match(
    fields.find((field) => field.path === "home.bestSellers.productIds")?.helpText ?? "",
    /leave empty.*newest/i,
  );
  assert.deepEqual(defaults.home.featuredItem.productIds, []);
  assert.equal(
    fields.some((field) => field.path.startsWith("footer.credit")),
    false,
  );
  assert.equal(new Set(fields.map((field) => field.prop)).size, fields.length);
  assert.equal(
    fields.some((field) => field.path === "header.navigation"),
    false,
  );
  assert.deepEqual(fields.find((field) => field.path === "home.categories.categoryIds")?.preview, {
    strategy: "variant-options",
    variants: ["featured", "standard"],
  });
  assert.equal(
    fields.some((field) => field.path === "footer.quickLinks"),
    false,
  );
});

test("NexaHub keeps the editor focused on the home page", () => {
  const manifest = storefrontEditorManifestSchema.parse(nexahubV1EditorSchema);
  assert.deepEqual(manifest.previewPages, [{ id: "home", label: "Home" }]);
  assert.equal(
    manifest.sections.some((section) => section.id === "listing"),
    false,
  );
  const pageIds = new Set(manifest.previewPages.map((page) => page.id));
  for (const section of manifest.sections) {
    if (section.previewPage) assert.ok(pageIds.has(section.previewPage));
  }
});

test("Afro exposes a clean editor schema and valid default contracts", () => {
  const manifest = storefrontEditorManifestSchema.parse(afroV1EditorSchema);
  const fields = manifest.sections.flatMap((section) => section.fields);
  const defaults = afroV1DataSchema.parse(afroV1Defaults);

  assert.equal(manifest.theme?.allowSurfaceMode, false);
  assert.deepEqual(manifest.theme?.editableColors, ["primary"]);
  assert.deepEqual(defaults.home.products.productIds, []);
  assert.deepEqual(defaults.home.categories.categoryIds, []);
  // Every template must leave contact details undefined in its defaults.
  // applyShopDetails back-fills them from Settings > Shop at read time, so a
  // literal here means a tenant without valid shopDetails publishes it.
  for (const [name, data] of [
    ["luvia", luviaV1Defaults],
    ["nexahub", nexahubV1Defaults],
    ["afro", afroV1Defaults],
  ] as const) {
    assert.equal(data.footer.email, undefined, `${name} default email must be undefined`);
    assert.equal(data.footer.phone, undefined, `${name} default phone must be undefined`);
    assert.equal(data.footer.address, undefined, `${name} default address must be undefined`);
  }
  assert.deepEqual(defaults.footer.socialLinks, []);
  assert.equal(
    fields.some((field) => field.path.startsWith("footer.credit")),
    false,
  );
  assert.equal(new Set(fields.map((field) => field.prop)).size, fields.length);
  assert.equal(
    fields.some((field) => field.path === "header.navigation"),
    false,
  );
  assert.equal(
    fields.some((field) => field.path === "footer.quickLinks"),
    false,
  );
  assert.deepEqual(fields.find((field) => field.path === "home.categories.categoryIds")?.preview, {
    strategy: "variant-options",
    variants: ["active", "standard"],
  });
  assert.deepEqual(manifest.previewPages, [{ id: "home", label: "Home" }]);
  assert.equal(
    manifest.sections.some((section) => section.id === "listing"),
    false,
  );
});
