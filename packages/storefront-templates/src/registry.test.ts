import assert from "node:assert/strict";
import test from "node:test";

import {
  getStorefrontTemplateDefinition,
  selectableStorefrontTemplates,
  storefrontTemplates,
} from "./registry";
import { luviaV1Defaults, luviaV1ThemeTokens } from "./templates/luvia/v1/defaults";
import { luviaV1DataSchema, luviaV1ThemeTokensSchema } from "./templates/luvia/v1/schema";

const syntheticTemplate = {
  ...storefrontTemplates[0],
  id: "00000000-0000-4000-8000-000000000099",
  versionId: "00000000-0000-4000-8000-000000000100",
  slug: "test-template",
  name: "Test template",
  templateKey: "test-template@1",
  defaultData: structuredClone(luviaV1Defaults),
  defaultThemeTokens: structuredClone(luviaV1ThemeTokens),
};

test("registers Luvia independently from its display name", () => {
  const template = getStorefrontTemplateDefinition("luvia@1");

  assert.ok(template);
  assert.equal(template.slug, "luvia");
  assert.equal(template.version, 1);
  assert.equal(template.templateKey, "luvia@1");
  assert.equal(template.availability, "selectable");
  assert.doesNotThrow(() => luviaV1DataSchema.parse(template.defaultData));
  assert.doesNotThrow(() => luviaV1ThemeTokensSchema.parse(template.defaultThemeTokens));
});

test("exposes only production-ready templates to merchants", () => {
  assert.deepEqual(
    selectableStorefrontTemplates.map((template) => template.templateKey),
    ["luvia@1"],
  );
  assert.equal(getStorefrontTemplateDefinition("mesob@1"), undefined);
  assert.equal(getStorefrontTemplateDefinition("removed@1"), undefined);
});

test("synthetic definitions preserve template-agnostic contract coverage", () => {
  for (const template of [...storefrontTemplates, syntheticTemplate]) {
    assert.equal(template.schema.safeParse(template.defaultData).success, true);
    assert.equal(template.themeSchema.safeParse(template.defaultThemeTokens).success, true);
  }
});

test("every registered template owns valid content and theme contracts", () => {
  for (const template of storefrontTemplates) {
    assert.equal(template.schema.safeParse(template.defaultData).success, true);
    assert.equal(template.themeSchema.safeParse(template.defaultThemeTokens).success, true);
  }
});

test("keeps template keys and database identities unique", () => {
  assert.equal(
    new Set(storefrontTemplates.map((item) => item.templateKey)).size,
    storefrontTemplates.length,
  );
  assert.equal(
    new Set(storefrontTemplates.map((item) => item.id)).size,
    storefrontTemplates.length,
  );
  assert.equal(
    new Set(storefrontTemplates.map((item) => item.versionId)).size,
    storefrontTemplates.length,
  );
});
