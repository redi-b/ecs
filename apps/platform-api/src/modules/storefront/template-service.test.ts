import assert from "node:assert/strict";
import test from "node:test";

import {
  luviaV1Defaults,
  luviaV1ThemeTokens,
} from "@ecs/storefront-templates";

import { normalizeStorefrontDraftPayload, resolveTemplateDraft } from "./template-service.js";

test("normalizes a Luvia draft with the Luvia theme contract", () => {
  const normalized = normalizeStorefrontDraftPayload({
    data: luviaV1Defaults,
    templateKey: "luvia@1",
    themeTokens: luviaV1ThemeTokens,
  });

  assert.ok(normalized);
  assert.equal(normalized.themeTokens.colorMode, "light");
  assert.deepEqual(normalized.themeTokens, luviaV1ThemeTokens);
});

test("resumes a saved draft instead of replacing it with template defaults", () => {
  const saved = { data: { headline: "Merchant edit" }, themeTokens: { primary: "#123456" } };
  const result = resolveTemplateDraft({
    defaultData: { headline: "Default" },
    defaultThemeTokens: { primary: "#000000" },
    mode: "resume",
    saved,
  });

  assert.equal(result.source, "saved");
  assert.deepEqual(result.data, saved.data);
  assert.deepEqual(result.themeTokens, saved.themeTokens);
});

test("a clean template start explicitly uses registry defaults", () => {
  const defaults = { headline: "Default" };
  const theme = { primary: "#000000" };
  const result = resolveTemplateDraft({
    defaultData: defaults,
    defaultThemeTokens: theme,
    mode: "clean",
    saved: { data: { headline: "Merchant edit" }, themeTokens: { primary: "#123456" } },
  });

  assert.equal(result.source, "clean");
  assert.deepEqual(result.data, defaults);
  assert.deepEqual(result.themeTokens, theme);
});
