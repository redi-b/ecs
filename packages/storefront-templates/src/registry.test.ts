import assert from "node:assert/strict";
import test from "node:test";

import { getStorefrontTemplateDefinition, storefrontTemplates } from "./registry";
import {
  luviaV1DataSchema,
  luviaV1ThemeTokensSchema,
} from "./templates/luvia/v1/schema";

test("registers Luvia independently from its display name", () => {
  const template = getStorefrontTemplateDefinition("luvia@1");

  assert.ok(template);
  assert.equal(template.slug, "luvia");
  assert.equal(template.version, 1);
  assert.equal(template.templateKey, "luvia@1");
  assert.doesNotThrow(() => luviaV1DataSchema.parse(template.defaultData));
  assert.doesNotThrow(() => luviaV1ThemeTokensSchema.parse(template.defaultThemeTokens));
});

test("every registered template owns valid content and theme contracts", () => {
  for (const template of storefrontTemplates) {
    assert.equal(template.schema.safeParse(template.defaultData).success, true);
    assert.equal(template.themeSchema.safeParse(template.defaultThemeTokens).success, true);
  }
});

test("keeps template keys and database identities unique", () => {
  assert.equal(new Set(storefrontTemplates.map((item) => item.templateKey)).size, storefrontTemplates.length);
  assert.equal(new Set(storefrontTemplates.map((item) => item.id)).size, storefrontTemplates.length);
  assert.equal(new Set(storefrontTemplates.map((item) => item.versionId)).size, storefrontTemplates.length);
});
